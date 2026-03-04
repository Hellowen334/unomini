import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { config } from 'dotenv';
import { RoomManager } from './rooms/RoomManager.js';
import { Matchmaker } from './rooms/Matchmaker.js';
import { validateWebAppData } from './auth/telegram.js';
import { prisma } from './db/prisma.js';
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
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'arya-uno-server' });
});
app.get('/api/leaderboard', async (req, res) => {
    try {
        const topPlayers = await prisma.user.findMany({
            orderBy: { wins: 'desc' },
            take: 10,
            select: { id: true, firstName: true, wins: true, level: true }
        });
        // BigInt convert to string for JSON
        const serialized = topPlayers.map((p) => ({
            ...p,
            id: p.id.toString()
        }));
        res.json(serialized);
    }
    catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
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
        if (!userStr)
            return next(new Error('User data missing'));
        const user = JSON.parse(decodeURIComponent(userStr));
        // DB Upsert
        const dbUser = await prisma.user.upsert({
            where: { id: BigInt(user.id) },
            update: {
                firstName: user.first_name,
                username: user.username || null,
            },
            create: {
                id: BigInt(user.id),
                firstName: user.first_name,
                username: user.username || null,
            }
        });
        socket.data.user = {
            id: Number(dbUser.id),
            firstName: dbUser.firstName,
            username: dbUser.username
        };
        next();
    }
    catch (err) {
        next(new Error('Internal server error during auth'));
    }
});
io.on('connection', (socket) => {
    const user = socket.data.user;
    console.log(`[Socket] Yeni bağlantı: ${socket.id} (Kullanıcı: ${user.firstName})`);
    const broadcastGameState = (roomId, game) => {
        io.sockets.sockets.forEach(s => {
            const user = s.data.user;
            if (user && roomManager.playerRooms.get(s.id) === roomId) {
                s.emit('game:stateUpdate', game.getState(user.id));
            }
        });
    };
    socket.on('room:create', (mode, user) => {
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
        }
        catch (e) {
            socket.emit('game:error', e.message);
        }
    });
    socket.on('matchmaking:join', (mode, user) => {
        matchmaker.joinQueue(socket, user.id, user.firstName, mode);
    });
    socket.on('matchmaking:leave', (userId) => {
        matchmaker.leaveQueue(userId);
    });
    socket.on('game:playCard', (cardId, chosenColor, user) => {
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId)
            return;
        const game = roomManager.games.get(roomId);
        if (!game)
            return;
        if (game.currentPlayer?.id !== user.id) {
            socket.emit('game:error', 'Sıra sizde değil!');
            return;
        }
        const playerCard = game.currentPlayer.cards.find(c => c.id === cardId);
        if (!playerCard)
            return;
        if (!game.currentPlayer.isCardPlayable(playerCard)) {
            socket.emit('game:error', 'Bu kartı oynayamazsınız!');
            return;
        }
        if (playerCard.special && chosenColor) {
            playerCard.color = chosenColor;
        }
        game.currentPlayer.play(playerCard);
        io.to(roomId).emit('game:cardPlayed', { playerId: user.id, card: playerCard.toJSON() });
        if (game.winner) {
            io.to(roomId).emit('game:finished', game.winner.id);
            roomManager.games.delete(roomId);
        }
        else {
            broadcastGameState(roomId, game);
        }
    });
    socket.on('game:drawCard', (user) => {
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId)
            return;
        const game = roomManager.games.get(roomId);
        if (!game || game.currentPlayer?.id !== user.id)
            return;
        if (game.currentPlayer.drew)
            return; // Zaten çekti
        try {
            const amount = game.drawCounter || 1;
            game.currentPlayer.draw();
            io.to(roomId).emit('game:cardDrawn', { playerId: user.id, count: amount });
            if (game.currentPlayer.getPlayableCards().length === 0) {
                game.turn();
            }
            broadcastGameState(roomId, game);
        }
        catch (e) {
            socket.emit('game:error', e.message);
        }
    });
    socket.on('game:pass', (user) => {
        const roomId = roomManager.playerRooms.get(socket.id);
        if (!roomId)
            return;
        const game = roomManager.games.get(roomId);
        if (!game || game.currentPlayer?.id !== user.id)
            return;
        if (!game.currentPlayer.drew)
            return;
        game.turn();
        broadcastGameState(roomId, game);
    });
    socket.on('disconnect', () => {
        console.log(`[Socket] Bağlantı koptu: ${socket.id}`);
        const user = socket.data.user;
        if (user) {
            roomManager.leaveRoom(socket, user.id);
        }
    });
});
httpServer.listen(PORT, () => {
    console.log(`🚀 Arya UNO Backend running on http://localhost:${PORT}`);
});
