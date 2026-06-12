/**
 * AeroBeat — Loading Screen Module
 * Manages the loading/analysis screen with animated progress bar
 * and status labels (BPM detection, engine status).
 */

/**
 * Update the progress bar width.
 * @param {number} progress - Value between 0 and 1.
 */
export function updateProgress(progress) {
    const bar = document.getElementById('loading-bar');
    if (bar) {
        bar.style.width = `${Math.round(progress * 100)}%`;
    }
}

/**
 * Reset the progress bar to 0%.
 */
export function resetProgress() {
    const bar = document.getElementById('loading-bar');
    if (bar) {
        bar.style.width = '0%';
    }
}

/**
 * Set the BPM label text on the loading screen.
 * @param {string} text - e.g. "128 BPM DETECTED"
 */
export function setBpmLabel(text) {
    const label = document.querySelector('#screen-loading .flex span:last-child');
    if (label) {
        label.textContent = text;
    }
}

/**
 * Set the engine status label text on the loading screen.
 * @param {string} text - e.g. "MP3 ENGINE READY"
 */
export function setEngineLabel(text) {
    const label = document.querySelector('#screen-loading .flex span:first-child');
    if (label) {
        label.textContent = text;
    }
}
