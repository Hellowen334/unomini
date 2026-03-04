import { Deck } from './Deck.js';
import { Player } from './Player.js';
import { SKIP, REVERSE, DRAW_TWO, DRAW_FOUR, CHOOSE } from './constants.js';
export class Game {
    id;
    deck;
    players = [];
    lastCard = null;
    currentPlayer = null;
    reversed = false;
    choosingColor = false;
    started = false;
    drawCounter = 0;
    mode;
    winner = null;
    constructor(id, mode = 'classic') {
        this.id = id;
        this.mode = mode;
        this.deck = new Deck();
    }
    addPlayer(id, firstName) {
        const player = new Player(this, id, firstName);
        if (this.players.length > 0) {
            const lastPlayer = this.players[this.players.length - 1];
            const firstPlayer = this.players[0];
            lastPlayer.next = player;
            player.prev = lastPlayer;
            player.next = firstPlayer;
            firstPlayer.prev = player;
        }
        else {
            player.next = player;
            player.prev = player;
            this.currentPlayer = player;
        }
        this.players.push(player);
        return player;
    }
    removePlayer(playerId) {
        const idx = this.players.findIndex(p => p.id === playerId);
        if (idx === -1)
            return;
        const player = this.players[idx];
        if (this.players.length > 1) {
            if (player.prev)
                player.prev.next = player.next;
            if (player.next)
                player.next.prev = player.prev;
            if (this.currentPlayer?.id === playerId) {
                this.currentPlayer = this.reversed ? player.prev : player.next;
            }
        }
        else {
            this.currentPlayer = null;
        }
        // Return cards to the deck
        for (const card of player.cards) {
            this.deck.dismiss(card);
        }
        this.players.splice(idx, 1);
    }
    start() {
        if (this.players.length < 2)
            throw new Error("Not enough players");
        if (this.mode === 'classic') {
            this.deck.fillClassic();
        }
        else {
            this.deck.fillWild();
        }
        for (const p of this.players) {
            p.drawFirstHand();
        }
        // Draw first card that is not a special card
        do {
            if (this.lastCard && this.lastCard.special) {
                this.deck.dismiss(this.lastCard);
            }
            this.lastCard = this.deck.draw();
        } while (this.lastCard.special);
        this.started = true;
        this.playCardEffects(this.lastCard, true);
    }
    turn() {
        if (!this.currentPlayer)
            return;
        this.currentPlayer = this.reversed ? this.currentPlayer.prev : this.currentPlayer.next;
        if (this.currentPlayer) {
            this.currentPlayer.drew = false;
        }
        this.choosingColor = false;
    }
    playCard(card) {
        if (this.lastCard) {
            this.deck.dismiss(this.lastCard);
        }
        this.lastCard = card;
        this.playCardEffects(card, false);
        // Check win condition
        if (this.currentPlayer && this.currentPlayer.cards.length === 0) {
            this.winner = this.currentPlayer;
        }
    }
    playCardEffects(card, isFirstCard) {
        if (card.value === SKIP) {
            this.turn();
        }
        else if (card.special === DRAW_FOUR) {
            this.drawCounter += 4;
        }
        else if (card.value === DRAW_TWO) {
            this.drawCounter += 2;
        }
        else if (card.value === REVERSE) {
            if (this.players.length === 2) {
                this.turn();
            }
            else {
                this.reversed = !this.reversed;
            }
        }
        if (card.special === CHOOSE || card.special === DRAW_FOUR) {
            this.choosingColor = true;
        }
        else {
            // Don't turn if someone played a card but we're just setting up the board
            if (!isFirstCard) {
                this.turn();
            }
        }
    }
    chooseColor(color) {
        if (this.lastCard) {
            this.lastCard.color = color;
        }
        this.turn();
    }
    getState(playerId) {
        const caller = this.players.find(p => p.id === playerId);
        return {
            roomId: this.id,
            phase: this.winner ? 'finished' : (this.started ? 'playing' : 'lobby'),
            mode: this.mode,
            lastCard: this.lastCard?.toJSON() || null,
            direction: this.reversed ? 'ccw' : 'cw',
            drawCounter: this.drawCounter,
            choosingColor: this.choosingColor,
            currentPlayerId: this.currentPlayer?.id || 0,
            players: this.players.map(p => p.toJSON()),
            myCards: caller ? caller.cards.map(c => c.toJSON()) : [],
            playableCardIds: caller ? caller.getPlayableCards().map(c => c.id) : [],
            winnerId: this.winner?.id || null
        };
    }
}
