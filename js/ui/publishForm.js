/**
 * AeroBeat — Publish Form Module
 * Modal form for publishing a track to the server.
 * Glassmorphism modal, glossy Frutiger Aero buttons.
 * Handles validation, upload with progress, 409 conflict dialog.
 */

import { showToast } from './notifications.js';

/** Backend API base URL */
const API_BASE = window.location.origin;

/** @type {File|null} Current audio file to publish */
let pendingFile = null;

/** @type {object|null} Current beatmap to publish */
let pendingBeatmap = null;

/** @type {function|null} Callback after successful publish (navigate to library) */
let onPublishSuccess = null;

/**
 * Initialize the publish form module.
 * Binds close/cancel buttons and form submission.
 * @param {function} onSuccess - Called after successful publish (e.g. navigate to library).
 */
export function initPublishForm(onSuccess) {
    onPublishSuccess = onSuccess;

    const modal = document.getElementById('publish-modal');
    const closeBtn = document.getElementById('publish-close');
    const cancelBtn = document.getElementById('publish-cancel');
    const form = document.getElementById('publish-form');

    if (closeBtn) closeBtn.addEventListener('click', closePublishForm);
    if (cancelBtn) cancelBtn.addEventListener('click', closePublishForm);

    if (form) {
        form.addEventListener('submit', handlePublishSubmit);
    }
}

/**
 * Open the publish form modal.
 * Pre-fills readonly fields from beatmap metadata.
 * @param {File} file - Audio file to publish.
 * @param {object} beatmap - Beatmap object with metadata.
 */
export function openPublishForm(file, beatmap) {
    pendingFile = file;
    pendingBeatmap = beatmap;

    const modal = document.getElementById('publish-modal');
    if (!modal) return;

    // Fill fields from beatmap metadata
    setInputValue('publish-title', beatmap.metadata?.title || '');
    setInputValue('publish-artist', beatmap.metadata?.artist || 'Unknown');
    setInputValue('publish-bpm', Math.round(beatmap.metadata?.bpm || 0));
    setInputValue('publish-duration', formatDuration(beatmap.metadata?.duration || 0));
    setInputValue('publish-note-count', beatmap.notes?.length || 0);

    // Reset state
    setPublishState('idle');

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Focus title input
    setTimeout(() => {
        const titleInput = document.getElementById('publish-title');
        if (titleInput) titleInput.focus();
    }, 100);
}

/**
 * Close the publish form modal.
 */
export function closePublishForm() {
    const modal = document.getElementById('publish-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    pendingFile = null;
    pendingBeatmap = null;
}

/**
 * Handle form submission.
 * @param {Event} e
 */
async function handlePublishSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('publish-title')?.value?.trim();
    const artist = document.getElementById('publish-artist')?.value?.trim();

    if (!title) {
        showToast('Track title is required');
        return;
    }
    if (!artist) {
        showToast('Artist name is required');
        return;
    }
    if (!pendingFile || !pendingBeatmap) {
        showToast('No track data to publish');
        return;
    }

    setPublishState('loading');

    try {
        const formData = new FormData();
        formData.append('audio', pendingFile);
        formData.append('title', title);
        formData.append('artist', artist);
        formData.append('bpm', pendingBeatmap.metadata?.bpm || 0);
        formData.append('duration', pendingBeatmap.metadata?.duration || 0);
        formData.append('beatmap', JSON.stringify(pendingBeatmap));

        const res = await fetch(`${API_BASE}/api/tracks`, {
            method: 'POST',
            body: formData,
        });

        const data = await res.json();

        if (res.ok) {
            setPublishState('success');
            showToast('Track published!', false);
            closePublishForm();
            if (onPublishSuccess) onPublishSuccess();
        } else if (res.status === 409) {
            // Duplicate — show conflict dialog
            showConflictDialog(data);
        } else {
            setPublishState('idle');
            showToast(data.error || 'Publish failed');
        }
    } catch (err) {
        setPublishState('idle');
        showToast('Network error: ' + err.message);
    }
}

/**
 * Show the 409 conflict dialog.
 * @param {object} data - Response with track_id, title, artist.
 */
function showConflictDialog(data) {
    const dialog = document.getElementById('publish-conflict-dialog');
    if (!dialog) return;

    const message = dialog.querySelector('.conflict-message');
    if (message) {
        message.textContent = `This track already exists as "${data.title}" by ${data.artist}. Play it instead?`;
    }

    setPublishState('idle');
    dialog.classList.remove('hidden');
    dialog.classList.add('flex');

    const playBtn = document.getElementById('conflict-play');
    const cancelBtn = document.getElementById('conflict-cancel');

    const cleanup = () => {
        dialog.classList.add('hidden');
        dialog.classList.remove('flex');
        playBtn?.removeEventListener('click', onPlay);
        cancelBtn?.removeEventListener('click', onCancel);
    };

    const onPlay = () => {
        cleanup();
        closePublishForm();
        // Trigger library play via callback
        if (onPublishSuccess) onPublishSuccess(data.track_id);
    };

    const onCancel = () => {
        cleanup();
    };

    playBtn?.addEventListener('click', onPlay, { once: true });
    cancelBtn?.addEventListener('click', onCancel, { once: true });
}

/**
 * Set the visual state of the publish form.
 * @param {'idle'|'loading'|'success'} state
 */
function setPublishState(state) {
    const submitBtn = document.getElementById('publish-submit');
    const progressWrap = document.getElementById('publish-progress');

    if (state === 'idle') {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Publish';
        }
        if (progressWrap) progressWrap.classList.add('hidden');
    } else if (state === 'loading') {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Publishing...';
        }
        if (progressWrap) progressWrap.classList.remove('hidden');
    } else if (state === 'success') {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Published!';
        }
    }
}

/**
 * Set an input element's value.
 */
function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
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
