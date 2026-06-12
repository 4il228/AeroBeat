/**
 * AeroBeat — Hit Detection
 * Categorizes hits based on timing delta and validates input.
 * Pure logic module — no DOM dependencies.
 */

/** Perfect hit window in seconds */
export const PERFECT_WINDOW = 0.050;

/** Good hit window in seconds */
export const GOOD_WINDOW = 0.120;

/** Maximum delta for a valid hit input */
export const INPUT_IGNORE_THRESHOLD = 0.5;

/**
 * Categorize a hit based on timing delta.
 * @param {number} delta - Absolute difference between note time and current time (seconds).
 * @returns {'perfect'|'good'|'miss'}
 */
export function categorizeHit(delta) {
    if (delta <= PERFECT_WINDOW) return 'perfect';
    if (delta <= GOOD_WINDOW) return 'good';
    return 'miss';
}

/**
 * Check if a hit input is within the valid threshold.
 * @param {number} delta - Absolute timing delta (seconds).
 * @returns {boolean}
 */
export function isHitValid(delta) {
    return delta < INPUT_IGNORE_THRESHOLD;
}
