import { Server, Socket } from 'socket.io';
import { RoomManager } from './RoomManager.js';
import { GameMode } from '../game/Game.js';

interface QueuedPlayer {
    socket: Socket;
    playerId: number;
    playerName: string;
    mode: GameMode;
}

export class Matchmaker {
    private io: Server;
    private roomManager: RoomManager;
    private queueClassic: QueuedPlayer[] = [];
    private queueWild: QueuedPlayer[] = [];

    constructor(io: Server, roomManager: RoomManager) {
        this.io = io;
        this.roomManager = roomManager;
    }

    joinQueue(socket: Socket, playerId: number, playerName: string, mode: GameMode = 'classic') {
        const queue = mode === 'classic' ? this.queueClassic : this.queueWild;
        if (queue.some(p => p.playerId === playerId)) return;

        // Açık bir hızlı maç odası varsa doğrudan o odaya katıl
        const openRoom = this.roomManager.getJoinableMatchmakingRoom(mode);
        if (openRoom) {
            try {
                this.roomManager.joinRoom(socket, openRoom.id, playerId, playerName);
                socket.emit('room:joined', {
                    id: openRoom.id,
                    code: openRoom.id,
                    hostId: openRoom.players[0]?.id || 0,
                    players: openRoom.players.map(p => p.toJSON()),
                    maxPlayers: 4,
                    mode: openRoom.mode
                });
                const newPlayer = openRoom.players.find(p => p.id === playerId);
                if (newPlayer) {
                    this.roomManager.io.to(openRoom.id).emit('room:playerJoined', newPlayer.toJSON());
                }
                // 2+ oyuncu olduğunda oyunu başlat
                if (openRoom.players.length >= 2) {
                    openRoom.start();
                    this.roomManager.removeMatchmakingRoom(openRoom.id);
                    this.roomManager.io.in(openRoom.id).fetchSockets().then(sockets => {
                        sockets.forEach(s => {
                            const u = s.data.user;
                            if (u) s.emit('game:started', openRoom.getState(u.id));
                        });
                    });
                }
            } catch {
                this.createMatchmakingRoom(socket, playerId, playerName, mode);
            }
            return;
        }

        // Açık oda yok — ilk oyuncu için yeni matchmaking odası oluştur
        this.createMatchmakingRoom(socket, playerId, playerName, mode);
    }

    private createMatchmakingRoom(socket: Socket, playerId: number, playerName: string, mode: GameMode) {
        const game = this.roomManager.createRoom(socket, playerId, playerName, mode, true);
        socket.emit('room:created', {
            id: game.id,
            code: game.id,
            hostId: playerId,
            players: game.players.map(p => p.toJSON()),
            maxPlayers: 4,
            mode: game.mode
        });
        socket.emit('matchmaking:waiting', 1);
    }

    leaveQueue(playerId: number) {
        this.queueClassic = this.queueClassic.filter(p => p.playerId !== playerId);
        this.queueWild = this.queueWild.filter(p => p.playerId !== playerId);
    }
}
