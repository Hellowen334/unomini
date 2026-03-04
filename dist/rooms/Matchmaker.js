export class Matchmaker {
    io;
    roomManager;
    queueClassic = [];
    queueWild = [];
    constructor(io, roomManager) {
        this.io = io;
        this.roomManager = roomManager;
    }
    joinQueue(socket, playerId, playerName, mode = 'classic') {
        const queue = mode === 'classic' ? this.queueClassic : this.queueWild;
        // Zaten kuyrukta mı kontrol et
        if (queue.some(p => p.playerId === playerId))
            return;
        queue.push({ socket, playerId, playerName, mode });
        // Herkesi bilgilendir (Kuyruk boyutu)
        queue.forEach(p => {
            p.socket.emit('matchmaking:waiting', queue.length);
        });
        this.checkQueue(mode);
    }
    leaveQueue(playerId) {
        this.queueClassic = this.queueClassic.filter(p => p.playerId !== playerId);
        this.queueWild = this.queueWild.filter(p => p.playerId !== playerId);
    }
    checkQueue(mode) {
        const queue = mode === 'classic' ? this.queueClassic : this.queueWild;
        // 2 oyuncu olunca hemen başlat
        if (queue.length >= 2) {
            const playersToMatch = queue.splice(0, 2);
            const host = playersToMatch[0];
            const game = this.roomManager.createRoom(host.socket, host.playerId, host.playerName, mode);
            for (let i = 1; i < playersToMatch.length; i++) {
                const p = playersToMatch[i];
                this.roomManager.joinRoom(p.socket, game.id, p.playerId, p.playerName);
            }
            // Oyunu başlat
            game.start();
            // Odadaki herkese oyunu başlat sinyali ve başlangıç durumunu gönder
            playersToMatch.forEach(p => {
                p.socket.emit('game:started', game.getState(p.playerId));
            });
            // Matchmaking'den çıkarılanlara found sinyali
            playersToMatch.forEach(p => {
                p.socket.emit('matchmaking:found', {
                    id: game.id,
                    code: game.id,
                    maxPlayers: 4,
                    mode: game.mode,
                    hostId: host.playerId,
                    players: game.players.map(x => x.toJSON())
                });
            });
        }
    }
}
