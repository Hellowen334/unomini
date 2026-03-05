import express, { type Request, type Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';
import { RoomManager } from './rooms/RoomManager.js';
import { Matchmaker } from './rooms/Matchmaker.js';
import { Game, GameMode } from './game/Game.js';
import type { Color } from './game/constants.js';
import { COLORS } from './game/constants.js';
import { validateWebAppData } from './auth/telegram.js';
import { prisma } from './db/prisma.js';
import { seedAchievements, ACHIEVEMENTS, checkAndUnlock } from './game/achievements.js';


config();

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const roomManager = new RoomManager(io);
const matchmaker = new Matchmaker(io, roomManager);

const PORT = process.env.PORT || 3001;

app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'arya-uno-server' });
});

app.get('/api/leaderboard', async (_req: Request, res: Response) => {
    try {
        const topPlayers = await prisma.user.findMany({
            orderBy: { wins: 'desc' },
            take: 10,
            select: { id: true, firstName: true, wins: true, level: true, photoUrl: true }
        });

        res.json(topPlayers);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/me', async (req: Request, res: Response) => {
    try {
        const initData = req.headers['x-telegram-init-data'] as string;
        const botToken = process.env.BOT_TOKEN;

        if (!botToken || process.env.NODE_ENV === 'development') {
            // Dev modda mock user veya ilk kullanıcıyı getir
            const user = await prisma.user.findFirst({ include: { achievements: { include: { achievement: true } } } });
            if (user) {
                return res.json({ ...user, id: user.id.toString() });
            }
            return res.status(404).json({ error: 'User not found in dev mode' });
        }

        if (!initData || !validateWebAppData(initData, botToken)) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const urlParams = new URLSearchParams(initData);
        const userStr = urlParams.get('user');
        if (!userStr) return res.status(400).json({ error: 'User data missing' });

        const userObj = JSON.parse(decodeURIComponent(userStr));
        const telegramId = BigInt(userObj.id);
        const dbUser = await prisma.user.findUnique({
            where: { telegramId },
            include: { achievements: { include: { achievement: true } } }
        });

        if (!dbUser) return res.status(404).json({ error: 'User not found' });

        res.json({
            ...dbUser,
            id: dbUser.id,
            telegramId: dbUser.telegramId ? dbUser.telegramId.toString() : null,
            winRate: dbUser.gamesPlayed > 0 ? Math.round((dbUser.wins / dbUser.gamesPlayed) * 100) : 0
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/achievements', async (_req: Request, res: Response) => {
    res.json(ACHIEVEMENTS);
});


// Auth Middleware
io.use(async (socket, next) => {
    try {
        const initData = socket.handshake.auth.initData;
        const botToken = process.env.BOT_TOKEN;

        // Geliştirme ortamında auth atla veya sahte kullanıcı al (kolay frontend DB testi için)
        if (!botToken || process.env.NODE_ENV === 'development') {
            socket.data.user = { id: Math.floor(Math.random() * 100000), firstName: 'Test' };
            return next();
        }

        if (!initData || !validateWebAppData(initData, botToken)) {
            return next(new Error('Authentication failed'));
        }

        const urlParams = new URLSearchParams(initData);
        const userStr = urlParams.get('user');
        if (!userStr) return next(new Error('User data missing'));

        const user = JSON.parse(decodeURIComponent(userStr));
        const telegramId = BigInt(user.id);

        // DB Upsert
        const dbUser = await prisma.user.upsert({
            where: { telegramId },
            update: {
                firstName: user.first_name,
                username: user.username || null,
                photoUrl: user.photo_url || null,
            },
            create: {
                telegramId,
                firstName: user.first_name,
                username: user.username || null,
                photoUrl: user.photo_url || null,
            }
        });


        socket.data.user = {
            id: Number(dbUser.id),
            firstName: dbUser.firstName,
            username: dbUser.username
        };

        next();
    } catch (err) {
        next(new Error('Internal server error during auth'));
    }
});

io.on('connection', (socket: Socket) => {
    const user = socket.data.user;
    console.log(`[Socket] Yeni bağlantı: ${socket.id} (Kullanıcı: ${user.firstName})`);

    socket.emit('auth:success', user);

    const broadcastGameState = (roomId: string, game: Game) => {
        io.sockets.sockets.forEach(s => {
            const user = s.data.user;
            if (user && roomManager.playerRooms.get(s.id) === roomId) {
                s.emit('game:stateUpdate', game.getState(user.id));
            }
        });
    };

    socket.on('room:create', (mode: GameMode) => {
        const user = socket.data.user;
        if (!user) return;
        try {
            const game = roomManager.createRoom(socket, user.id, user.firstName, mode);
            socket.emit('room:created', {
                id: game.id,
                code: game.id,
                hostId: user.id,
                players: game.players.map(p => p.toJSON()),
                maxPlayers: 4,
                mode: game.mode
            });
        } catch (e: unknown) {
            socket.emit('game:error', e instanceof Error ? e.message : 'Odaya katılamadı');
        }
    });

    socket.on('game:start', () => {
        const user = socket.data.user;
        if (!user) return;
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId) return;
        const game = roomManager.games.get(roomId);
        if (!game) return;

        // Check if user is host
        if (game.players[0].id !== user.id) {
            socket.emit('game:error', 'Sadece oda kurucusu oyunu başlatabilir.');
            return;
        }

        // Check minimum player condition
        if (game.players.length < 2) {
            socket.emit('game:error', 'Oyunu başlatmak için en az 2 oyuncu gerekiyor.');
            return;
        }

        if (game.started) return;

        try {
            game.start();
            // Emit game:started and the initial state to all players in the room
            io.sockets.sockets.forEach(s => {
                const u = s.data.user;
                if (u && roomManager.playerRooms.get(s.id) === roomId) {
                    s.emit('game:started', game.getState(u.id));
                }
            });
        } catch (e: unknown) {
            socket.emit('game:error', e instanceof Error ? e.message : 'Oyun başlatılamadı');
        }
    });

    socket.on('matchmaking:join', (mode: GameMode) => {
        const user = socket.data.user;
        if (!user) return;
        matchmaker.joinQueue(socket, user.id, user.firstName, mode);
    });

    socket.on('matchmaking:leave', () => {
        const user = socket.data.user;
        if (!user) return;
        matchmaker.leaveQueue(user.id);
    });

    socket.on('game:playCard', async (cardId: string, chosenColor?: Color) => {
        const user = socket.data.user;
        if (!user) return;
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId) return;
        const game = roomManager.games.get(roomId);
        if (!game) return;

        if (!game.currentPlayer || game.currentPlayer.id !== user.id) return;

        const playerCard = game.currentPlayer.cards.find(c => c.id === cardId);
        if (!playerCard) return;

        if (!game.currentPlayer.isCardPlayable(playerCard)) {
            socket.emit('game:error', 'Bu kartı oynayamazsınız!');
            return;
        }

        if (playerCard.special && chosenColor) {
            playerCard.color = chosenColor;
        }

        game.currentPlayer.play(playerCard);

        // UNO Penalty Check
        if (game.currentPlayer.cards.length === 1 && !game.currentPlayer.calledUno) {
            game.currentPlayer.cards.push(game.deck.draw());
            game.currentPlayer.cards.push(game.deck.draw());
            io.to(roomId).emit('game:error', `${game.currentPlayer.firstName} UNO demeyi unuttuğu için 2 ceza kartı çekti!`);
        }

        io.to(roomId).emit('game:cardPlayed', { playerId: user.id, card: playerCard.toJSON() });

        if (game.winner) {
            // Process Winnings and Stats
            const winner = game.winner;
            const losers = game.players.filter(p => p.id !== winner.id);

            try {
                // Winner Stats
                const winnerDb = await prisma.user.findUnique({ where: { id: winner.id } });
                if (winnerDb) {
                    const newXp = (winnerDb.xp || 0) + 100 + (winner.cardsPlayed * 2);
                    const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
                    const leveledUp = newLevel > (winnerDb.level || 1);

                    await prisma.user.update({
                        where: { id: winner.id },
                        data: {
                            wins: { increment: 1 },
                            gamesPlayed: { increment: 1 },
                            cardsPlayed: { increment: winner.cardsPlayed },
                            xp: newXp,
                            level: newLevel
                        }
                    });

                    if (leveledUp) {
                        io.to(roomId).emit('player:levelUp', { playerId: winner.id, level: newLevel });
                    }

                    // Achievement Check
                    await checkAndUnlock(winner.id, 'WIN', { mode: game.mode });
                }

                // Loser Stats
                for (const loser of losers) {
                    const loserDb = await prisma.user.findUnique({ where: { id: loser.id } });
                    if (loserDb) {
                        const newXp = (loserDb.xp || 0) + 20 + (loser.cardsPlayed * 2);
                        const newLevel = Math.floor(Math.sqrt(newXp / 100)) + 1;
                        const leveledUp = newLevel > (loserDb.level || 1);

                        await prisma.user.update({
                            where: { id: loser.id },
                            data: {
                                gamesPlayed: { increment: 1 },
                                cardsPlayed: { increment: loser.cardsPlayed },
                                xp: newXp,
                                level: newLevel,
                                losses: { increment: 1 }
                            }
                        });

                        if (leveledUp) {
                            io.to(roomId).emit('player:levelUp', { playerId: loser.id, level: newLevel });
                        }

                        // Achievement Check for losers (e.g., participation or specific events)
                        await checkAndUnlock(loser.id, 'LOSE', { mode: game.mode });
                    }
                }
            } catch (err) {
                console.error("DB Update Error on Game Finish:", err);
            }


            io.to(roomId).emit('game:finished', {
                winnerId: winner.id,
                players: game.players.map(p => ({
                    id: p.id,
                    cardsPlayed: p.cardsPlayed,
                    cardCount: p.cards.length
                }))
            });

            roomManager.games.delete(roomId);
        } else {
            broadcastGameState(roomId, game);
        }
    });

    socket.on('game:drawCard', () => {
        const user = socket.data.user;
        if (!user) return;
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId) return;
        const game = roomManager.games.get(roomId);
        if (!game || !game.currentPlayer || game.currentPlayer.id !== user.id) return;

        if (game.currentPlayer.drew) return; // Zaten çekti

        try {
            const hadPenalty = game.drawCounter > 0;
            const drawnCount = game.currentPlayer.draw();
            io.to(roomId).emit('game:cardDrawn', { playerId: user.id, count: drawnCount });

            if (hadPenalty || game.currentPlayer.getPlayableCards().length === 0) {
                game.turn();
            }

            broadcastGameState(roomId, game);
        } catch (e: unknown) {
            socket.emit('game:error', e instanceof Error ? e.message : 'Kart çekilemedi');
        }
    });

    socket.on('game:pass', () => {
        const user = socket.data.user;
        if (!user) return;
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId) return;
        const game = roomManager.games.get(roomId);
        if (!game || !game.currentPlayer || game.currentPlayer.id !== user.id) return;

        if (!game.currentPlayer.drew) return;
        game.turn();
        broadcastGameState(roomId, game);
    });

    socket.on('game:callUno', () => {
        const user = socket.data.user;
        if (!user) return;
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId) return;
        const game = roomManager.games.get(roomId);
        if (!game) return;

        const player = game.players.find(p => p.id === user.id);
        if (player) {
            player.calledUno = true;
            io.to(roomId).emit('game:unoCall', player.id);
            broadcastGameState(roomId, game);
        }
    });

    /** Botlarla hızlı oyun: oda oluştur, 3 bot ekle, oyunu başlat, bot turunu zamanla */
    socket.on('quickplay:start', () => {
        const user = socket.data.user;
        if (!user) return;
        try {
            const roomId = roomManager.generateRoomCode();
            const game = new Game(roomId, 'classic', () => {});
            game.addPlayer(user.id, user.firstName);
            game.addPlayer(-1, 'Bot Alfa');
            game.addPlayer(-2, 'Bot Beta');
            game.addPlayer(-3, 'Bot Gama');
            roomManager.games.set(roomId, game);
            roomManager.playerRooms.set(socket.id, roomId);
            socket.join(roomId);
            game.start();
            socket.emit('game:started', game.getState(user.id));
            scheduleBotTurn(roomId);
        } catch (e: unknown) {
            socket.emit('game:error', e instanceof Error ? e.message : 'Hızlı oyun başlatılamadı');
        }
    });

    function scheduleBotTurn(roomId: string) {
        const game = roomManager.games.get(roomId);
        if (!game || game.winner) return;
        if (game.currentPlayer && game.currentPlayer.id < 0) {
            setTimeout(() => doBotTurn(roomId), 1400);
        }
    }

    function doBotTurn(roomId: string) {
        const game = roomManager.games.get(roomId);
        if (!game || game.winner) return;
        const bot = game.currentPlayer;
        if (!bot || bot.id >= 0) return;

        if (game.choosingColor) {
            const color = COLORS[Math.floor(Math.random() * COLORS.length)];
            game.chooseColor(color);
            roomManager.broadcastGameState(roomId, game);
            return scheduleBotTurn(roomId);
        }

        const playable = bot.getPlayableCards();
        if (playable.length > 0) {
            const card = playable[Math.floor(Math.random() * playable.length)];
            if (card.special && !card.color) {
                card.color = COLORS[Math.floor(Math.random() * COLORS.length)];
            }
            bot.play(card);
            if (bot.cards.length === 1 && !bot.calledUno) {
                bot.cards.push(game.deck.draw());
                bot.cards.push(game.deck.draw());
                io.to(roomId).emit('game:error', `${bot.firstName} UNO demeyi unuttu!`);
            }
            io.to(roomId).emit('game:cardPlayed', { playerId: bot.id, card: card.toJSON() });
            const winner = game.winner as { id: number } | null;
            if (winner) {
                io.to(roomId).emit('game:finished', {
                    winnerId: winner.id,
                    players: game.players.map(p => ({ id: p.id, cardsPlayed: p.cardsPlayed, cardCount: p.cards.length }))
                });
                roomManager.games.delete(roomId);
                return;
            }
        } else {
            bot.draw();
            game.turn();
        }
        roomManager.broadcastGameState(roomId, game);
        scheduleBotTurn(roomId);
    }

    socket.on('room:join', (code: string) => {
        const user = socket.data.user;
        if (!user) return;
        try {
            const game = roomManager.joinRoom(socket, code, user.id, user.firstName);
            socket.emit('room:joined', {
                id: game.id,
                code: game.id,
                hostId: game.players[0]?.id || 0,
                players: game.players.map(p => p.toJSON()),
                maxPlayers: 4,
                mode: game.mode
            });
            // roomManager.joinRoom already emits room:playerJoined to others!
            broadcastGameState(code, game);
        } catch (e: unknown) {
            socket.emit('game:error', e instanceof Error ? e.message : 'Odaya katılamadı');
        }
    });

    socket.on('room:leave', () => {
        const user = socket.data.user;
        if (!user) return;
        roomManager.leaveRoom(socket, user.id);
        socket.emit('room:left');
    });

    socket.on('disconnect', () => {
        console.log(`[Socket] Bağlantı koptu: ${socket.id}`);
        const user = socket.data.user;
        if (user) {
            matchmaker.leaveQueue(user.id);
            roomManager.handleDisconnect(socket, user.id);
        }
    });

});

httpServer.listen(PORT, async () => {
    await seedAchievements();
    console.log(`🚀 Arya UNO Backend running on http://localhost:${PORT}`);
});

