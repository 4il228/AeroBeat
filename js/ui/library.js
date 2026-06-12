/**
 * AeroBeat — Library Screen Module
 * Displays server-published tracks in a glassmorphism card grid.
 * Supports search/filter, play button, empty state.
 */

import { showToast } from './notifications.js';

/** Backend API base URL */
const API_BASE = window.location.origin;

/** @type {Array<object>} Cached track list */
let tracksCache = [];

/** @type {function|null} Callback to start gameplay from a library track */
let onPlayTrack = null;

/**
 * Initialize library module.
 * @param {function(number): void} playTrackCb - Called with track ID when Play is clicked.
 */
export function initLibrary(playTrackCb) {
    onPlayTrack = playTrackCb;

    const searchInput = document.getElementById('library-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderTracks(searchInput.value.trim().toLowerCase());
        });
    }

    const backBtn = document.getElementById('library-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.navigate('screen-main-menu');
        });
    }
}

/**
 * Load tracks from server and render the library screen.
 */
export async function loadLibrary() {
    const grid = document.getElementById('library-grid');
    const empty = document.getElementById('library-empty');

    if (grid) grid.innerHTML = '';
    if (empty) empty.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/api/tracks`);
        const data = await res.json();
        tracksCache = data.tracks || [];
    } catch (err) {
        tracksCache = [];
        showToast('Failed to load library: ' + err.message);
    }

    renderTracks('');
}

/**
 * Render track cards filtered by search query.
 * @param {string} query - Lowercase search string.
 */
function renderTracks(query) {
    const grid = document.getElementById('library-grid');
    const empty = document.getElementById('library-empty');
    if (!grid) return;

    const filtered = tracksCache.filter(t => {
        if (!query) return true;
        return (t.title || '').toLowerCase().includes(query)
            || (t.artist || '').toLowerCase().includes(query);
    });

    grid.innerHTML = '';

    if (filtered.length === 0) {
        if (empty) empty.classList.remove('hidden');
        return;
    }

    if (empty) empty.classList.add('hidden');

    filtered.forEach(track => {
        grid.appendChild(createTrackCard(track));
    });
}

/**
 * Create a single track card DOM element.
 * @param {object} track - Track data from API.
 * @returns {HTMLElement}
 */
function createTrackCard(track) {
    const card = document.createElement('div');
    card.className = 'aero-glass rounded-2xl p-5 flex flex-col gap-3 border border-white/50 hover:border-white/70 transition-all duration-200';

    const duration = formatDuration(track.duration || 0);

    card.innerHTML = `
        <div class="flex justify-between items-start">
            <div class="flex-1 min-w-0">
                <h4 class="font-headline-md text-lg font-bold text-on-surface truncate">${escapeHtml(track.title)}</h4>
                <p class="font-body-md text-sm text-on-surface-variant truncate">${escapeHtml(track.artist)}</p>
            </div>
        </div>
        <div class="flex items-center gap-3 text-xs font-label-sm text-on-surface-variant/70">
            <span>${Math.round(track.bpm || 0)} BPM</span>
            <span class="opacity-40">|</span>
            <span>${duration}</span>
            <span class="opacity-40">|</span>
            <span>${track.note_count || 0} notes</span>
        </div>
        <button class="glossy-button bg-gradient-to-b from-secondary-container to-secondary text-white font-headline-md px-6 py-2.5 rounded-full text-sm shadow-lg hover:scale-105 active:scale-95 mt-1 library-play-btn" data-track-id="${track.id}">
            <span class="relative z-10 flex items-center gap-2 justify-center">
                <span class="material-symbols-outlined text-lg" style="font-variation-settings: 'FILL' 1;">play_arrow</span>
                Play
            </span>
        </button>
    `;

    const playBtn = card.querySelector('.library-play-btn');
    playBtn.addEventListener('click', () => {
        if (onPlayTrack) onPlayTrack(track.id);
    });

    return card;
}

/**
 * Format seconds to mm:ss.
 * @param {number} secs
 * @returns {string}
 */
function formatDuration(secs) {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Escape HTML to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
