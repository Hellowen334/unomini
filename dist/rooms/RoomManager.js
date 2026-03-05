import { Game } from '../game/Game.js';
export class RoomManager {
    io;
    games = new Map();
    /** socket.id -> roomId */
    playerRooms = new Map();
    /** Hızlı maç ile açılmış, katılıma açık oda id'leri */
    matchmakingRoomIds = new Set();
    constructor(io) {
        this.io = io;
    }
    /** Aynı modda, başlamamış ve 4'ten az oyuncusu olan matchmaking odası bulur */
    getJoinableMatchmakingRoom(mode) {
        for (const roomId of this.matchmakingRoomIds) {
            const game = this.games.get(roomId);
            if (game && !game.started && game.mode === mode && game.players.length < 4) {
                return game;
            }
        }
        return null;
    }
    broadcastGameState(roomId, game) {
        this.io.sockets.sockets.forEach(s => {
            const user = s.data.user;
            if (user && this.playerRooms.get(s.id) === roomId) {
                s.emit('game:stateUpdate', game.getState(user.id));
            }
        });
    }
    /** Sadece 5 rakamdan oluşan oda kodu üretir (0-9) */
    generateRoomCode() {
        let code = '';
        do {
            code = '';
            for (let i = 0; i < 5; i++) {
                code += Math.floor(Math.random() * 10).toString();
            }
        } while (this.games.has(code));
        return code;
    }
    createRoom(socket, hostId, hostName, mode = 'classic', isMatchmaking = false) {
        const roomId = this.generateRoomCode();
        const game = new Game(roomId, mode, (g) => this.broadcastGameState(roomId, g));
        game.addPlayer(hostId, hostName);
        this.games.set(roomId, game);
        if (isMatchmaking) {
            this.matchmakingRoomIds.add(roomId);
        }
        this.playerRooms.set(socket.id, roomId);
        socket.join(roomId);
        return game;
    }
    removeMatchmakingRoom(roomId) {
        this.matchmakingRoomIds.delete(roomId);
    }
    joinRoom(socket, roomId, playerId, playerName) {
        const game = this.games.get(roomId);
        if (!game)
            throw new Error('Oda bulunamadı');
        if (game.started)
            throw new Error('Oyun zaten başladı');
        if (game.players.length >= 4)
            throw new Error('Oda dolu');
        const isAlreadyIn = game.players.some(p => p.id === playerId);
        if (!isAlreadyIn) {
            const player = game.addPlayer(playerId, playerName);
            this.io.to(roomId).emit('room:playerJoined', player.toJSON());
        }
        this.playerRooms.set(socket.id, roomId);
        socket.join(roomId);
        return game;
    }
    leaveRoom(socket, playerId) {
        const roomId = this.playerRooms.get(socket.id);
        if (!roomId)
            return;
        const game = this.games.get(roomId);
        if (game) {
            game.removePlayer(playerId);
            socket.leave(roomId);
            this.io.to(roomId).emit('room:playerLeft', playerId);
            // If room is empty, clean it up
            if (game.players.length === 0) {
                this.matchmakingRoomIds.delete(roomId);
                this.games.delete(roomId);
            }
            else if (game.players.length < 2 && game.started) {
                // Not enough players to continue
                this.io.to(roomId).emit('game:error', 'Yeterli oyuncu kalmadığı için maç sona erdi.');
                this.games.delete(roomId);
            }
            else if (game.started) {
                // Broadcaster handles state, here we just let the disconnection happen
                // It's better to tell index.ts to broadcast but we don't have access to game.getState(playerId) easily without iterating sockets
                this.io.to(roomId).emit('game:error', 'Bir oyuncu ayrıldı.');
            }
        }
        this.playerRooms.delete(socket.id);
    }
    handleDisconnect(socket, playerId) {
        this.leaveRoom(socket, playerId);
    }
}
