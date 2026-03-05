export const XP_PER_WIN = 100;
export const XP_PER_GAME = 20;
export const XP_PER_CARD = 2;
export function calculateLevel(xp) {
    // Basic level formula: level = floor(sqrt(xp / 100)) + 1
    // 0 XP = Level 1
    // 100 XP = Level 2
    // 400 XP = Level 3
    // 900 XP = Level 4
    return Math.floor(Math.sqrt(xp / 100)) + 1;
}
export function getXpForNextLevel(level) {
    // Formula inverse: xp = (level)^2 * 100
    return Math.pow(level, 2) * 100;
}
