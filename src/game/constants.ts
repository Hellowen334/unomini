// ── Card Constants ───────────────────────────────
export const RED = 'r' as const;
export const BLUE = 'b' as const;
export const GREEN = 'g' as const;
export const YELLOW = 'y' as const;
export const BLACK = 'x' as const;

export const COLORS = [RED, BLUE, GREEN, YELLOW] as const;
export type Color = typeof COLORS[number];
export type AnyColor = Color | typeof BLACK;

// ── Values ───────────────────────────────────────
export const ZERO = '0' as const;
export const ONE = '1' as const;
export const TWO = '2' as const;
export const THREE = '3' as const;
export const FOUR = '4' as const;
export const FIVE = '5' as const;
export const SIX = '6' as const;
export const SEVEN = '7' as const;
export const EIGHT = '8' as const;
export const NINE = '9' as const;
export const DRAW_TWO = 'draw' as const;
export const REVERSE = 'reverse' as const;
export const SKIP = 'skip' as const;

export const VALUES = [
    ZERO, ONE, TWO, THREE, FOUR, FIVE,
    SIX, SEVEN, EIGHT, NINE, DRAW_TWO, REVERSE, SKIP,
] as const;
export const WILD_VALUES = [ONE, TWO, THREE, FOUR, FIVE, DRAW_TWO, REVERSE, SKIP] as const;
export type Value = typeof VALUES[number];

// ── Special Cards ────────────────────────────────
export const CHOOSE = 'colorchooser' as const;
export const DRAW_FOUR = 'draw_four' as const;

// ── Bonus Cards ──────────────────────────────────
export const FIRE = 'fire' as const;
export const ICE = 'ice' as const;
export const LIGHTNING = 'lightning' as const;
export const WIND = 'wind' as const;
export const DIAMOND = 'diamond' as const;
export const SHIELD = 'shield' as const;
export const TARGET = 'target' as const;
export const LUCK = 'luck' as const;
export const TIME = 'time' as const;
export const STAR = 'star' as const;
export const CIRCUS = 'circus' as const;

export const BONUS_SPECIALS = [FIRE, ICE, LIGHTNING, WIND, DIAMOND, SHIELD, TARGET, LUCK, TIME, STAR, CIRCUS] as const;

export const SPECIALS = [CHOOSE, DRAW_FOUR, ...BONUS_SPECIALS] as const;
export type Special = typeof SPECIALS[number];
