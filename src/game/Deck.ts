import { Card } from './Card.js';
import { COLORS, ZERO, ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE, DRAW_TWO, SKIP, REVERSE, CHOOSE, DRAW_FOUR, SPECIALS, BONUS_SPECIALS, WILD_VALUES } from './constants.js';

export class DeckEmptyError extends Error {
    constructor() {
        super('Deste boş');
        this.name = 'DeckEmptyError';
    }
}

export class Deck {
    cards: Card[] = [];
    graveyard: Card[] = [];

    constructor() { }

    shuffle() {
        for (let i = this.cards.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
        }
    }

    draw(): Card {
        if (this.cards.length === 0) {
            if (this.graveyard.length > 0) {
                this.cards = [...this.graveyard];
                this.graveyard = [];
                this.shuffle();
                return this.draw();
            } else {
                throw new DeckEmptyError();
            }
        }
        return this.cards.pop()!;
    }

    dismiss(card: Card) {
        this.graveyard.push(card);
    }

    fillClassic() {
        this.cards = [];
        for (const color of COLORS) {
            // One '0'
            this.cards.push(new Card(color, ZERO));

            // Two of each 1-9
            const numericals = [ONE, TWO, THREE, FOUR, FIVE, SIX, SEVEN, EIGHT, NINE];
            for (const val of numericals) {
                this.cards.push(new Card(color, val));
                this.cards.push(new Card(color, val));
            }

            // Two of each action card
            const actions = [SKIP, REVERSE, DRAW_TWO];
            for (const val of actions) {
                this.cards.push(new Card(color, val));
                this.cards.push(new Card(color, val));
            }
        }

        // Four Wilds and Four Wild Draw Fours
        for (let i = 0; i < 4; i++) {
            this.cards.push(new Card(null, null, CHOOSE));
            this.cards.push(new Card(null, null, DRAW_FOUR));
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
            if (BONUS_SPECIALS.includes(special as any)) {
                for (let i = 0; i < 2; i++) {
                    this.cards.push(new Card(null, null, special));
                }
            } else if (special === DRAW_FOUR) {
                for (let i = 0; i < 8; i++) {
                    this.cards.push(new Card(null, null, special));
                }
            } else {
                for (let i = 0; i < 6; i++) {
                    this.cards.push(new Card(null, null, special));
                }
            }
        }
        this.shuffle();
    }
}
