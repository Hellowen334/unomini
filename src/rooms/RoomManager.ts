import { Game, GameMode } from '../game/Game.js';
import { Server, Socket } from 'socket.io';

export class RoomManager {
    private io: Server;
    public games: Map<string, Game> = new Map();
    // socket.id -> roomId
    public playerRooms: Map<string, string> = new Map();

    constructor(io: Server) {
        this.io = io;
    }

    broadcastGameState(roomId: string, game: Game) {
        this.io.sockets.sockets.forEach(s => {
            const user = s.data.user;
            if (user && this.playerRooms.get(s.id) === roomId) {
                s.emit('game:stateUpdate', game.getState(user.id));
            }
        });
    }


    generateRoomCode(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        do {
            code = '';
            for (let i = 0; i < 6; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        } while (this.games.has(code));
        return code;
    }

    createRoom(socket: Socket, hostId: number, hostName: string, mode: GameMode = 'classic') {
        const roomId = this.generateRoomCode();
        const game = new Game(roomId, mode, (g) => this.broadcastGameState(roomId, g));


        game.addPlayer(hostId, hostName);
        this.games.set(roomId, game);

        this.playerRooms.set(socket.id, roomId);
        socket.join(roomId);

        return game;
    }

    joinRoom(socket: Socket, roomId: string, playerId: number, playerName: string) {
        const game = this.games.get(roomId);
        if (!game) throw new Error('Oda bulunamadı');
        if (game.started) throw new Error('Oyun zaten başladı');
        if (game.players.length >= 4) throw new Error('Oda dolu');

        const isAlreadyIn = game.players.some(p => p.id === playerId);
        if (!isAlreadyIn) {
            const player = game.addPlayer(playerId, playerName);
            this.io.to(roomId).emit('room:playerJoined', player.toJSON());
        }

        this.playerRooms.set(socket.id, roomId);
        socket.join(roomId);

        return game;
    }

    leaveRoom(socket: Socket, playerId: number) {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId) return;

        const game = this.games.get(roomId);
        if (game) {
            game.removePlayer(playerId);
            socket.leave(roomId);
            this.io.to(roomId).emit('room:playerLeft', playerId);

            // If room is empty, clean it up
            if (game.players.length === 0) {
                this.games.delete(roomId);
            } else if (game.players.length < 2 && game.started) {
                // Not enough players to continue
                this.io.to(roomId).emit('game:error', 'Yeterli oyuncu kalmadığı için maç sona erdi.');
                this.games.delete(roomId);
            } else if (game.started) {
                // Broadcaster handles state, here we just let the disconnection happen
                // It's better to tell index.ts to broadcast but we don't have access to game.getState(playerId) easily without iterating sockets
                this.io.to(roomId).emit('game:error', 'Bir oyuncu ayrıldı.');
            }
        }
        this.playerRooms.delete(socket.id);
    }

    handleDisconnect(socket: Socket, playerId: number) {
        this.leaveRoom(socket, playerId);
    }
}
