import { DRAW_TWO, DRAW_FOUR, CHOOSE } from './constants.js';
export class Player {
    id;
    firstName;
    cards = [];
    game;
    // Game linked list structure
    next = null;
    prev = null;
    drew = false;
    bluffing = false;
    calledUno = false;
    constructor(game, id, firstName) {
        this.game = game;
        this.id = id;
        this.firstName = firstName;
    }
    drawFirstHand() {
        for (let i = 0; i < 7; i++) {
            this.cards.push(this.game.deck.draw());
        }
    }
    draw() {
        const amount = this.game.drawCounter || 1;
        for (let i = 0; i < amount; i++) {
            this.cards.push(this.game.deck.draw());
        }
        this.game.drawCounter = 0;
        this.drew = true;
        this.calledUno = false;
    }
    play(card) {
        const idx = this.cards.findIndex(c => c.id === card.id);
        if (idx > -1) {
            this.cards.splice(idx, 1);
        }
        this.game.playCard(card);
    }
    getPlayableCards() {
        const playable = [];
        const last = this.game.lastCard;
        if (!last)
            return [];
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
        // You cannot play a special card if it's your last card
        if (this.cards.length === 1 && this.cards[0].special) {
            return [];
        }
        return playable;
    }
    isCardPlayable(card) {
        const last = this.game.lastCard;
        if (!last)
            return true;
        let isPlayable = true;
        if (card.color !== last.color && card.value !== last.value && !card.special) {
            isPlayable = false;
        }
        else if (last.value === DRAW_TWO && this.game.drawCounter > 0) {
            if (!(card.value === DRAW_TWO || card.special === DRAW_FOUR)) {
                isPlayable = false;
            }
        }
        else if (last.special === DRAW_FOUR && this.game.drawCounter > 0) {
            if (!(card.value === DRAW_TWO || card.special === DRAW_FOUR)) {
                isPlayable = false;
            }
        }
        else if ((last.special === CHOOSE || last.special === DRAW_FOUR) &&
            (card.special === CHOOSE || card.special === DRAW_FOUR)) {
            // Cannot play special on another special directly without color chosen
            isPlayable = false;
        }
        else if (!last.color) {
            // Color hasn't been chosen yet
            isPlayable = false;
        }
        return isPlayable;
    }
    toJSON() {
        return {
            id: this.id,
            firstName: this.firstName,
            cardCount: this.cards.length,
            isCurrentTurn: this.game.currentPlayer?.id === this.id,
            calledUno: this.calledUno,
            drew: this.drew
        };
    }
}
