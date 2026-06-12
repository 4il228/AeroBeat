/**
 * AeroBeat — Scoring System
 * Tracks score, combo, multiplier, accuracy, and grade.
 * Pure logic module — no DOM dependencies.
 */

/** Base points per hit zone */
const BASE_POINTS = {
    perfect: 300,
    good: 100,
    miss: 0,
};

/**
 * Create a fresh scoring state.
 * @returns {object} Scoring state object.
 */
export function createScoringState() {
    return {
        score: 0,
        combo: 0,
        maxCombo: 0,
        multiplier: 1,
        perfectCount: 0,
        goodCount: 0,
        missCount: 0,
        totalNotes: 0,
    };
}

/**
 * Process a hit and update scoring state.
 * @param {object} state - Scoring state from createScoringState().
 * @param {'perfect'|'good'|'miss'} hitType - The categorized hit result.
 * @returns {object} { score, combo, multiplier, addedScore } after the hit.
 */
export function processHit(state, hitType) {
    state.totalNotes++;

    if (hitType === 'miss') {
        state.combo = 0;
        state.multiplier = 1;
        state.missCount++;
    } else {
        state.combo++;
        if (state.combo > state.maxCombo) {
            state.maxCombo = state.combo;
        }
        state.multiplier = 1 + Math.floor(state.combo / 50);

        const addedScore = BASE_POINTS[hitType] * state.multiplier;
        state.score += addedScore;

        if (hitType === 'perfect') {
            state.perfectCount++;
        } else {
            state.goodCount++;
        }

        return { score: state.score, combo: state.combo, multiplier: state.multiplier, addedScore };
    }

    return { score: state.score, combo: state.combo, multiplier: state.multiplier, addedScore: 0 };
}

/**
 * Calculate accuracy percentage.
 * @param {object} state - Scoring state.
 * @returns {number} Accuracy 0-100.
 */
export function calculateAccuracy(state) {
    if (state.totalNotes === 0) return 0;
    return ((state.perfectCount + state.goodCount) / state.totalNotes) * 100;
}

/**
 * Determine grade from accuracy.
 * @param {number} accuracy - Accuracy percentage (0-100).
 * @returns {'S'|'A'|'B'|'C'|'D'}
 */
export function determineGrade(accuracy) {
    if (accuracy >= 95) return 'S';
    if (accuracy >= 85) return 'A';
    if (accuracy >= 70) return 'B';
    if (accuracy >= 50) return 'C';
    return 'D';
}

/**
 * Format score with leading zeros.
 * @param {number} score
 * @returns {string}
 */
export function formatScore(score) {
    return score.toString().padStart(5, '0');
}
