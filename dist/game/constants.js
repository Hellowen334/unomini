// ── Card Constants ───────────────────────────────
export const RED = 'r';
export const BLUE = 'b';
export const GREEN = 'g';
export const YELLOW = 'y';
export const BLACK = 'x';
export const COLORS = [RED, BLUE, GREEN, YELLOW];
// ── Values ───────────────────────────────────────
export const ZERO = '0';
export const ONE = '1';
export const TWO = '2';
export const THREE = '3';
export const FOUR = '4';
export const FIVE = '5';
export const SIX = '6';
export const SEVEN = '7';
export const EIGHT = '8';
export const NINE = '9';
export const DRAW_TWO = 'draw';
export const REVERSE = 'reverse';
export const SKIP = 'skip';
export const VALUES = [
    ZERO, ONE, TWO, THREE, FOUR, FIVE,
    SIX, SEVEN, EIGHT, NINE, DRAW_TWO, REVERSE, SKIP,
];
export const WILD_VALUES = [ONE, TWO, THREE, FOUR, FIVE, DRAW_TWO, REVERSE, SKIP];
// ── Special Cards ────────────────────────────────
export const CHOOSE = 'colorchooser';
export const DRAW_FOUR = 'draw_four';
// ── Bonus Cards ──────────────────────────────────
export const FIRE = 'fire';
export const ICE = 'ice';
export const LIGHTNING = 'lightning';
export const WIND = 'wind';
export const DIAMOND = 'diamond';
export const SHIELD = 'shield';
export const TARGET = 'target';
export const LUCK = 'luck';
export const TIME = 'time';
export const STAR = 'star';
export const CIRCUS = 'circus';
export const BONUS_SPECIALS = [FIRE, ICE, LIGHTNING, WIND, DIAMOND, SHIELD, TARGET, LUCK, TIME, STAR, CIRCUS];
export const SPECIALS = [CHOOSE, DRAW_FOUR, ...BONUS_SPECIALS];
