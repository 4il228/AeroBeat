/**
 * AeroBeat — Note Module
 * Manages Note DOM elements with Object Pooling.
 * Each note is a water-drop sphere positioned via CSS transform.
 */

/** Pool of pre-created note DOM elements */
const pool = [];

/** Active notes mapped by note index */
const active = new Map();

/** Notes container element (set during init) */
let containerEl = null;

/** Lane X positions in pixels (relative to notes-container) */
let lanePositions = [];

/**
 * Initialize the note system.
 * @param {HTMLElement} container - The #notes-container element.
 * @param {number[]} positions - X positions for each lane in pixels.
 * @param {number} poolSize - Number of DOM elements to pre-create.
 */
export function initNotes(container, positions, poolSize = 30) {
    containerEl = container;
    lanePositions = positions;

    // Clear existing pool
    for (const el of pool) {
        el.remove();
    }
    pool.length = 0;
    active.clear();

    // Pre-create pool elements
    for (let i = 0; i < poolSize; i++) {
        const el = document.createElement('div');
        el.className = 'note';
        el.style.display = 'none';
        el.style.position = 'absolute';
        containerEl.appendChild(el);
        pool.push(el);
    }
}

/**
 * Spawn a note DOM element from the pool.
 * @param {number} noteIndex - Index in the beatmap notes array.
 * @param {number} lane - Lane index (0-3).
 * @returns {HTMLElement|null} The note element, or null if pool exhausted.
 */
export function spawnNote(noteIndex, lane) {
    if (active.has(noteIndex)) return active.get(noteIndex);

    // Find an available pool element
    let el = null;
    for (const candidate of pool) {
        if (candidate.style.display === 'none') {
            el = candidate;
            break;
        }
    }

    if (!el) return null;

    el.style.display = 'block';
    el.dataset.noteIndex = noteIndex;
    el.dataset.lane = lane;
    active.set(noteIndex, el);
    return el;
}

/**
 * Update a note's Y position based on timing.
 * @param {HTMLElement} el - The note DOM element.
 * @param {number} y - Y position in pixels.
 */
export function updateNotePosition(el, y) {
    el.style.transform = `translateY(${y}px)`;
}

/**
 * Despawn (hide) a note back to the pool.
 * @param {number} noteIndex - Index in the beatmap notes array.
 */
export function despawnNote(noteIndex) {
    const el = active.get(noteIndex);
    if (!el) return;

    el.style.display = 'none';
    el.style.transform = '';
    delete el.dataset.noteIndex;
    delete el.dataset.lane;
    active.delete(noteIndex);
}

/**
 * Get the active note element for a given index.
 * @param {number} noteIndex
 * @returns {HTMLElement|undefined}
 */
export function getActiveNote(noteIndex) {
    return active.get(noteIndex);
}

/**
 * Despawn all active notes and return pool to clean state.
 */
export function clearAllNotes() {
    for (const [noteIndex] of active) {
        despawnNote(noteIndex);
    }
}


