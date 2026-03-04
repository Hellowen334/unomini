import { Card } from './Card.js';
import { Deck } from './Deck.js';
import { Player } from './Player.js';
import { SKIP, REVERSE, DRAW_TWO, DRAW_FOUR, CHOOSE, Color } from './constants.js';

export type GameMode = 'classic' | 'wild';
export type Direction = 'cw' | 'ccw';

export class Game {
    id: string;
    deck: Deck;
    players: Player[] = [];
    lastCard: Card | null = null;
    previousCard: Card | null = null;
    currentPlayer: Player | null = null;
    reversed: boolean = false;
    choosingColor: boolean = false;
    started: boolean = false;
    drawCounter: number = 0;
    mode: GameMode;
    winner: Player | null = null;
    turnTimeout: NodeJS.Timeout | null = null;
    turnStartTime: number = 0;
    readonly TURN_DURATION = 31000; // 30 seconds + 1s buffer


    onStateChange: (game: Game) => void;

    constructor(id: string, mode: GameMode = 'classic', onStateChange: (game: Game) => void) {
        this.id = id;
        this.mode = mode;
        this.deck = new Deck();
        this.onStateChange = onStateChange;
    }


    addPlayer(id: number, firstName: string): Player {
        const player = new Player(this, id, firstName);

        if (this.players.length > 0) {
            const lastPlayer = this.players[this.players.length - 1];
            const firstPlayer = this.players[0];

            lastPlayer.next = player;
            player.prev = lastPlayer;

            player.next = firstPlayer;
            firstPlayer.prev = player;
        } else {
            player.next = player;
            player.prev = player;
            this.currentPlayer = player;
        }

        this.players.push(player);
        return player;
    }

    removePlayer(playerId: number) {
        const idx = this.players.findIndex(p => p.id === playerId);
        if (idx === -1) return;

        const player = this.players[idx];
        if (this.players.length > 1) {
            if (player.prev) player.prev.next = player.next;
            if (player.next) player.next.prev = player.prev;

            if (this.currentPlayer?.id === playerId) {
                this.currentPlayer = this.reversed ? player.prev : player.next;
            }
        } else {
            this.currentPlayer = null;
        }

        // Return cards to the deck
        for (const card of player.cards) {
            this.deck.dismiss(card);
        }

        this.players.splice(idx, 1);
    }

    start() {
        if (this.players.length < 2) throw new Error("Not enough players");

        if (this.mode === 'classic') {
            this.deck.fillClassic();
        } else {
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
        if (this.turnTimeout) {
            clearTimeout(this.turnTimeout);
            this.turnTimeout = null;
        }

        if (!this.currentPlayer) return;

        if (this.currentPlayer.doubleTurn) {
            this.currentPlayer.doubleTurn = false;
            this.currentPlayer.drew = false;
            this.choosingColor = false;
            this.startTurnTimer();
            return; // They get another turn
        }

        do {
            this.currentPlayer = this.reversed ? this.currentPlayer!.prev : this.currentPlayer!.next;
            if (this.currentPlayer?.frozen) {
                this.currentPlayer.frozen = false; // Ice melts
            } else {
                break;
            }
        } while (true);

        if (this.currentPlayer) {
            this.currentPlayer.drew = false;
        }
        this.choosingColor = false;
        this.startTurnTimer();
    }

    startTurnTimer() {
        if (this.turnTimeout) clearTimeout(this.turnTimeout);
        this.turnStartTime = Date.now();
        this.turnTimeout = setTimeout(() => {
            this.handleTimeout();
        }, this.TURN_DURATION);
    }

    handleTimeout() {
        if (!this.currentPlayer || this.winner) return;

        // Auto draw card if didn't draw, or just pass if can
        if (!this.currentPlayer.drew) {
            this.currentPlayer.draw();
        }

        this.turn();
        this.onStateChange(this);
    }



    playCard(card: Card) {
        if (this.lastCard) {
            this.previousCard = this.lastCard;
            this.deck.dismiss(this.lastCard);
        }
        this.lastCard = card;
        this.playCardEffects(card, false);

        // Check win condition
        if (this.currentPlayer && this.currentPlayer.cards.length === 0) {
            this.winner = this.currentPlayer;
        }
    }

    private playCardEffects(card: Card, isFirstCard: boolean) {
        let shouldWaitColor = false;

        if (card.value === SKIP) {
            this.turn();
        } else if (card.special === DRAW_FOUR) {
            this.drawCounter += 4;
            if (!card.color) shouldWaitColor = true;
        } else if (card.value === DRAW_TWO) {
            this.drawCounter += 2;
        } else if (card.value === REVERSE) {
            if (this.players.length === 2) {
                this.turn();
            } else {
                this.reversed = !this.reversed;
            }
        }

        // Apply bonus effects if any
        if (card.special && ![CHOOSE, DRAW_FOUR].includes(card.special as any)) {
            this.applyBonusEffect(card.special);
            // Most bonus cards need a color if they are black (Wild)
            if (!card.color && !isFirstCard) {
                // Determine if this specific bonus card needs a color choice
                // Usually black (wild) variants do.
                shouldWaitColor = true;
            }
        }

        if (card.special === CHOOSE) {
            if (!card.color) shouldWaitColor = true;
        }

        if (shouldWaitColor && !isFirstCard) {
            this.choosingColor = true;
        } else if (!isFirstCard) {
            this.turn();
        }
    }

    private applyBonusEffect(special: string) {
        switch (special) {
            case 'fire':
                this.players.forEach(p => {
                    if (p !== this.currentPlayer) {
                        for (let i = 0; i < 3; i++) p.cards.push(this.deck.draw());
                    }
                });
                break;
            case 'ice':
                this.players.forEach(p => {
                    if (p !== this.currentPlayer) p.frozen = true;
                });
                break;
            case 'lightning':
                this.players.forEach(p => {
                    if (p !== this.currentPlayer) p.cards.push(this.deck.draw());
                });
                break;
            case 'wind':
                this.reversed = !this.reversed;
                break;
            case 'diamond':
                if (this.currentPlayer) {
                    for (const c of this.currentPlayer.cards) this.deck.dismiss(c);
                    this.currentPlayer.cards = [];
                    for (let i = 0; i < 7; i++) this.currentPlayer.cards.push(this.deck.draw());
                }
                break;
            case 'shield':
                if (this.currentPlayer) this.currentPlayer.shieldActive = true;
                break;
            case 'target':
                const opponents = this.players.filter(p => p !== this.currentPlayer);
                if (opponents.length > 0) {
                    const target = opponents[Math.floor(Math.random() * opponents.length)];
                    for (let i = 0; i < 2; i++) target.cards.push(this.deck.draw());
                }
                break;
            case 'luck':
                const effects = ['fire', 'ice', 'lightning', 'wind'];
                const randomEffect = effects[Math.floor(Math.random() * effects.length)];
                this.applyBonusEffect(randomEffect);
                break;
            case 'time':
                if (this.previousCard && this.lastCard) {
                    this.deck.dismiss(this.lastCard);
                    this.lastCard = this.previousCard;
                    this.previousCard = null;
                }
                break;
            case 'star':
                if (this.currentPlayer) this.currentPlayer.doubleTurn = true;
                break;
            case 'circus':
                const allCards: Card[] = [];
                for (const p of this.players) {
                    allCards.push(...p.cards);
                    p.cards = [];
                }
                for (let i = allCards.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [allCards[i], allCards[j]] = [allCards[j], allCards[i]];
                }
                const cardsPerPlayer = Math.floor(allCards.length / this.players.length) || 1;
                for (let i = 0; i < this.players.length; i++) {
                    const start = i * cardsPerPlayer;
                    const end = start + cardsPerPlayer;
                    this.players[i].cards = allCards.slice(start, end);
                }
                // Any remainder cards got lost or we can push them to graveyard
                break;
        }
    }

    chooseColor(color: Color) {
        if (this.lastCard) {
            this.lastCard.color = color;
        }
        this.turn();
    }

    getState(playerId: number) {
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
            winnerId: this.winner?.id || null,
            turnTimeLeft: this.currentPlayer ? Math.max(0, this.TURN_DURATION - (Date.now() - this.turnStartTime)) : 0
        };

    }
}
