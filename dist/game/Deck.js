import { Card } from './Card.js';
import { COLORS, VALUES, WILD_VALUES, SPECIALS, ZERO, DRAW_TWO, DRAW_FOUR } from './constants.js';
export class DeckEmptyError extends Error {
    constructor() {
        super('Deste boş');
        this.name = 'DeckEmptyError';
    }
}
export class Deck {
    cards = [];
    graveyard = [];
    constructor() { }
    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }
    draw() {
        if (this.cards.length === 0) {
            if (this.graveyard.length > 0) {
                this.cards = [...this.graveyard];
                this.graveyard = [];
                this.shuffle();
                return this.draw();
            }
            else {
                throw new DeckEmptyError();
            }
        }
        return this.cards.pop();
    }
    dismiss(card) {
        if (card.special) {
            card.color = null; // Rengi sıfırla
        }
        this.graveyard.push(card);
    }
    fillClassic() {
        this.cards = [];
        for (const color of COLORS) {
            for (const value of VALUES) {
                this.cards.push(new Card(color, value));
                if (value !== ZERO) {
                    this.cards.push(new Card(color, value));
                }
                if (value === DRAW_TWO) { // Extra draw twos for excitement
                    this.cards.push(new Card(color, value));
                    this.cards.push(new Card(color, value));
                }
            }
        }
        for (const special of SPECIALS) {
            if (special === DRAW_FOUR) {
                for (let i = 0; i < 6; i++) {
                    this.cards.push(new Card(null, null, special));
                }
            }
            else {
                for (let i = 0; i < 4; i++) {
                    this.cards.push(new Card(null, null, special));
                }
            }
        }
        this.shuffle();
    }
    fillWild() {
        this.cards = [];
        for (const color of COLORS) {
            for (const value of WILD_VALUES) {
                for (let i = 0; i < 4; i++) {
                    this.cards.push(new Card(color, value));
                }
                if (value === DRAW_TWO) {
                    for (let i = 0; i < 2; i++) {
                        this.cards.push(new Card(color, value));
                    }
                }
            }
        }
        for (const special of SPECIALS) {
            if (special === DRAW_FOUR) {
                for (let i = 0; i < 8; i++) {
                    this.cards.push(new Card(null, null, special));
                }
            }
            else {
                for (let i = 0; i < 6; i++) {
                    this.cards.push(new Card(null, null, special));
                }
            }
        }
        this.shuffle();
    }
}
