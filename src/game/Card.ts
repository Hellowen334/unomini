import { AnyColor, Value, Special, SPECIALS } from './constants.js';

let cardIdCounter = 0;

export class Card {
    id: string;
    color: AnyColor | null;
    value: Value | null;
    special: Special | null;

    constructor(color: AnyColor | null, value: Value | null, special: Special | null = null) {
        this.id = `card_${++cardIdCounter}_${Date.now()}`;
        this.color = color;
        this.value = value;
        this.special = special;
    }

    toString(): string {
        if (this.special) {
            return this.special;
        }
        return `${this.color}_${this.value}`;
    }

    isEqual(other: Card): boolean {
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

export function fromString(str: string): Card {
    if (SPECIALS.includes(str as Special)) {
        return new Card(null, null, str as Special);
    }
    const [c, v] = str.split('_');
    return new Card(c as AnyColor, v as Value);
}
