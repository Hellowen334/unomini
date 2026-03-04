import { SPECIALS } from './constants.js';
let cardIdCounter = 0;
export class Card {
    id;
    color;
    value;
    special;
    constructor(color, value, special = null) {
        this.id = `card_${++cardIdCounter}_${Date.now()}`;
        this.color = color;
        this.value = value;
        this.special = special;
    }
    toString() {
        if (this.special) {
            return this.special;
        }
        return `${this.color}_${this.value}`;
    }
    isEqual(other) {
        return this.toString() === other.toString();
    }
    // Frontend verisi için serialize
    toJSON() {
        return {
            id: this.id,
            color: this.color,
            value: this.value,
            special: this.special
        };
    }
}
export function fromString(str) {
    if (SPECIALS.includes(str)) {
        return new Card(null, null, str);
    }
    const [c, v] = str.split('_');
    return new Card(c, v);
}
