/**
 * AeroBeat — Receptor Module
 * Manages receptor DOM elements and flash effects.
 * Receptors are the hit targets at the bottom of the track.
 */

/** Receptor DOM elements indexed by lane */
const receptorElements = [];

/** Flash timeout handles per lane */
const flashTimers = {};

/** Flash duration in milliseconds */
const FLASH_DURATION = 120;

/**
 * Initialize receptor system by querying existing DOM elements.
 * @param {number} laneCount - Number of lanes (4).
 */
export function initReceptors(laneCount = 4) {
    receptorElements.length = 0;

    for (let i = 0; i < laneCount; i++) {
        const el = document.querySelector(`.receptor[data-lane="${i}"]`);
        receptorElements.push(el);
    }
}

/**
 * Trigger flash effect on a receptor.
 * @param {number} lane - Lane index (0-3).
 */
export function flashReceptor(lane) {
    const el = receptorElements[lane];
    if (!el) return;

    // Clear existing flash timer for this lane
    if (flashTimers[lane]) {
        clearTimeout(flashTimers[lane]);
    }

    el.classList.add('flash');

    flashTimers[lane] = setTimeout(() => {
        el.classList.remove('flash');
        flashTimers[lane] = null;
    }, FLASH_DURATION);
}

/**
 * Get the center X position of a receptor lane relative to the viewport.
 * Used for positioning spawned notes.
 * @param {number} lane - Lane index (0-3).
 * @param {HTMLElement} notesContainer - The notes container element.
 * @returns {number} X offset in pixels from the container's left edge.
 */
export function getLaneX(lane, notesContainer) {
    const receptor = receptorElements[lane];
    if (!receptor || !notesContainer) return 0;

    const receptorRect = receptor.getBoundingClientRect();
    const containerRect = notesContainer.getBoundingClientRect();

    return receptorRect.left + receptorRect.width / 2 - containerRect.left;
}

/**
 * Get the Y position of receptors relative to the notes container.
 * This is the hit target line.
 * @param {HTMLElement} notesContainer - The notes container element.
 * @returns {number} Y offset in pixels from the container's top edge.
 */
export function getReceptorY(notesContainer) {
    const receptor = receptorElements[0];
    if (!receptor || !notesContainer) return 0;

    const receptorRect = receptor.getBoundingClientRect();
    const containerRect = notesContainer.getBoundingClientRect();

    return receptorRect.top + receptorRect.height / 2 - containerRect.top;
}

/**
 * Clear all receptor flash states.
 */
export function clearAllFlashes() {
    for (const lane in flashTimers) {
        if (flashTimers[lane]) {
            clearTimeout(flashTimers[lane]);
            flashTimers[lane] = null;
        }
        const el = receptorElements[lane];
        if (el) el.classList.remove('flash');
    }
}
