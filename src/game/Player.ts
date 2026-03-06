import { Card } from './Card.js';
import { DRAW_TWO, DRAW_FOUR, CHOOSE } from './constants.js';
import { Game } from './Game.js';

export class Player {
    id: number;
    firstName: string;
    cards: Card[] = [];
    game: Game;

    // Game linked list structure
    next: Player | null = null;
    prev: Player | null = null;

    drew: boolean = false;
    bluffing: boolean = false;
    calledUno: boolean = false;
    frozen: boolean = false;
    shieldActive: boolean = false;
    doubleTurn: boolean = false;
    cardsPlayed: number = 0;

    constructor(game: Game, id: number, firstName: string) {
        this.game = game;
        this.id = id;
        this.firstName = firstName;
    }

    draw(): number {
        if (this.game.drawCounter > 0 && this.shieldActive) {
            this.shieldActive = false;
            this.game.drawCounter = 0;
            this.drew = true; // Act as if they drew (turn skip applies)
            this.calledUno = false;
            return 0;
        }

        const amount = this.game.drawCounter || 1;
        for (let i = 0; i < amount; i++) {
            this.cards.push(this.game.deck.draw());
        }
        this.game.drawCounter = 0;
        this.drew = true;
        this.calledUno = false;
        return amount;
    }

    play(card: Card) {
        const idx = this.cards.findIndex(c => c.id === card.id);
        if (idx > -1) {
            this.cards.splice(idx, 1);
            this.cardsPlayed++;
        }
        this.game.playCard(card);
    }

    getPlayableCards(): Card[] {
        const playable: Card[] = [];
        const last = this.game.lastCard;
        if (!last) return [];

        let cardsToCheck = this.cards;
        if (this.drew) {
            cardsToCheck = [this.cards[this.cards.length - 1]];
        }

        this.bluffing = false;

        for (const card of cardsToCheck) {
            if (this.isCardPlayable(card)) {
                playable.push(card);
                if (card.color === last.color) {
                    this.bluffing = true;
                }
            }
        }

        return playable;
    }

    isCardPlayable(card: Card): boolean {
        // If the current game is waiting for a color choice, no card can be played until that's settled.
        if (this.game.choosingColor) return false;

        const last = this.game.lastCard;
        if (!last) return true;

        // Penalty Stacking Rules - only +2 or +4 can be played on penalty
        if (this.game.drawCounter > 0) {
            // Can play +2 on +2
            if (card.value === DRAW_TWO) return true;
            // Can play +4 on any penalty
            if (card.special === DRAW_FOUR) return true;
            return false;
        }

        // Wild/Special cards without color are always playable
        // (Choose and Draw4 before color selection)
        if (card.special && !card.color) {
            return true;
        }

        // Wild cards with color selected - match the selected color
        if (card.special === DRAW_FOUR || card.special === CHOOSE) {
            // Check if selected color matches last card's color
            return card.color === last.color;
        }

        // Bonus special cards - match by color OR special type
        if (card.special) {
            // Match by color
            if (card.color === last.color) return true;
            // Match by special type (e.g., fire on fire)
            if (card.special === last.special) return true;
            return false;
        }

        // Basic Matching rules: match color OR match value
        if (card.color === last.color) return true;
        if (card.value !== null && card.value === last.value) return true;

        return false;
    }

    toJSON() {
        return {
            id: this.id,
            firstName: this.firstName,
            cardCount: this.cards.length,
            isCurrentTurn: this.game.currentPlayer?.id === this.id,
            calledUno: this.calledUno,
            drew: this.drew,
            frozen: this.frozen,
            shieldActive: this.shieldActive,
            doubleTurn: this.doubleTurn
        };
    }
}
