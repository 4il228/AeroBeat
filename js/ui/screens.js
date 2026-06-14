/**
 * AeroBeat — Screen Management Module
 * Handles navigation between game screens (menu, loading, gameplay, results).
 * Each screen is a <section> element toggled via 'hidden' class.
 */

/** Ordered list of all screen element IDs */
const SCREEN_IDS = [
    'screen-main-menu',
    'screen-loading',
    'screen-gameplay',
    'screen-results',
    'screen-profile'
];

/** @type {function|null} Callback invoked when leaving gameplay screen */
let onLeaveGameplay = null;

/**
 * Register a callback to run when navigating away from gameplay.
 * @param {function|null} cb
 */
export function setOnLeaveGameplay(cb) {
    onLeaveGameplay = cb;
}

/**
 * Navigate to a screen by its element ID, hiding all others.
 * @param {string} screenId - Target screen element ID.
 */
export function navigate(screenId) {
    SCREEN_IDS.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    const target = document.getElementById(screenId);
    if (target) target.classList.remove('hidden');

    if (screenId !== 'screen-gameplay' && onLeaveGameplay) {
        onLeaveGameplay();
    }
}

/**
 * Get the list of screen IDs.
 * @returns {string[]}
 */
export function getScreenIds() {
    return [...SCREEN_IDS];
}
