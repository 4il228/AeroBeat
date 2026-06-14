/**
 * AeroBeat — HUD Module
 * In-game heads-up display: score, combo, progress bar, song title.
 * Uses glass-panel elements from the gameplay screen.
 */

/**
 * Update the score display with leading zeros.
 * @param {number} score - Current score value.
 */
export function updateScore(score) {
    const el = document.getElementById('score-display');
    if (el) {
        el.textContent = score.toString().padStart(5, '0');
    }
}

/**
 * Update the combo display.
 * @param {number} combo - Current combo count.
 */
export function updateCombo(combo) {
    const el = document.getElementById('combo-display');
    if (el) {
        el.textContent = `x${combo}`;
    }
}

/**
 * Update the in-game progress bar fill.
 * @param {number} progress - Value between 0 and 1.
 */
export function updateProgress(progress) {
    const fill = document.querySelector('#screen-gameplay .liquid-fill');
    if (fill) {
        fill.style.width = `${Math.round(progress * 100)}%`;
    }
}

/**
 * Set the song title displayed below the progress bar.
 * @param {string} title
 */
export function setSongTitle(title) {
    const el = document.querySelector('#screen-gameplay .italic.font-bold');
    if (el) {
        el.textContent = title;
    }
}
