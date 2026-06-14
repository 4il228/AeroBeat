/**
 * AeroBeat — Conductor
 * Core game loop: spawns/despawns notes, positions them based on audio time,
 * detects missed notes, and triggers game end.
 * Synchronizes visual state with AudioPlayer.currentTime.
 *
 * Supports a freeze phase before gameplay: notes are drawn at a fixed position
 * (~100px above receptor) so the player can analyze the first batch,
 * then music and falling start simultaneously and in sync.
 */

import { spawnNote, updateNotePosition, despawnNote, getActiveNote, clearAllNotes } from './note.js';
import { flashReceptor, getLaneX, getReceptorY } from './receptor.js';

/** Time before hitTime when a note becomes visible (seconds) */
const LEAD_TIME = 2.0;

/** Speed of notes in pixels per second */
const NOTE_SPEED = 400;

/** Time after hitTime before a missed note is despawned (seconds) */
const DESPAWN_TIME = 1.0;

/** Maximum time delta for a note to be considered hittable (seconds) */
const HIT_WINDOW = 0.12;

/** Pixels above receptor where first note is frozen */
const FREEZE_OFFSET_PX = 100;

/**
 * Create a Conductor instance.
 * @param {object} options
 * @param {object} options.beatmap - Beatmap object with notes array.
 * @param {object} options.audioPlayer - AudioPlayer instance.
 * @param {HTMLElement} options.notesContainer - DOM container for notes.
 * @param {HTMLElement} options.receptorsContainer - DOM container for receptors.
 * @param {function(object): void} options.onMiss - Callback when a note is missed.
 * @param {function(): void} options.onGameEnd - Callback when all notes processed and audio ended.
 */
export function createConductor({ beatmap, audioPlayer, notesContainer, receptorsContainer, onMiss, onGameEnd }) {
    /** @type {Set<number>} indices of notes that have been hit or missed */
    const processedNotes = new Set();

    /** @type {Set<number>} indices of notes that are visible on screen (y >= 0) */
    const visibleNotes = new Set();

    /** @type {boolean} */
    let running = false;

    /** @type {number|null} */
    let rafId = null;

    /** Pre-compute lane X positions */
    let laneXPositions = [];

    /** Pre-compute receptor Y position */
    let receptorY = 0;

    /** Whether input (tryHit) is allowed */
    let inputEnabled = false;

    function computePositions() {
        laneXPositions = [];
        for (let i = 0; i < 4; i++) {
            laneXPositions.push(getLaneX(i, notesContainer));
        }
        receptorY = getReceptorY(notesContainer);
    }

    /**
     * Position notes at a given time. Used by both freeze and normal gameplay.
     * @param {number} currentTime
     * @param {boolean} suppressMisses - If true, misses are silently skipped.
     */
    function processNotes(currentTime, suppressMisses) {
        const notes = beatmap.notes;

        for (let i = 0; i < notes.length; i++) {
            if (processedNotes.has(i)) continue;

            const note = notes[i];
            const timeUntilHit = note.time - currentTime;

            if (timeUntilHit > LEAD_TIME) break;

            if (timeUntilHit > -DESPAWN_TIME) {
                let el = getActiveNote(i);
                if (!el) {
                    el = spawnNote(i, note.track);
                }

                if (el) {
                    const y = receptorY - (timeUntilHit * NOTE_SPEED);
                    updateNotePosition(el, y);

                    const x = laneXPositions[note.track] || 0;
                    el.style.left = `${x - 20}px`;

                    if (y >= 0) {
                        visibleNotes.add(i);
                    }
                }
            }

            if (timeUntilHit < -DESPAWN_TIME) {
                processedNotes.add(i);

                if (visibleNotes.has(i)) {
                    visibleNotes.delete(i);
                    despawnNote(i);
                    if (!suppressMisses && onMiss) onMiss(i, note);
                } else {
                    despawnNote(i);
                }
            }
        }
    }

    /**
     * Position notes once for the freeze phase.
     * Only spawns and positions — does NOT despawn or track misses.
     * @param {number} time
     */
    function positionFrozen(time) {
        const notes = beatmap.notes;
        for (let i = 0; i < notes.length; i++) {
            const note = notes[i];
            const timeUntilHit = note.time - time;

            if (timeUntilHit > LEAD_TIME) break;
            if (timeUntilHit <= -DESPAWN_TIME) continue;

            let el = getActiveNote(i);
            if (!el) {
                el = spawnNote(i, note.track);
            }

            if (el) {
                const y = receptorY - (timeUntilHit * NOTE_SPEED);
                updateNotePosition(el, y);

                const x = laneXPositions[note.track] || 0;
                el.style.left = `${x - 20}px`;
            }
        }
    }

    /**
     * Main update loop — called every animation frame during gameplay.
     */
    function update() {
        if (!running) return;

        processNotes(audioPlayer.currentTime, false);

        const notes = beatmap.notes;
        if (audioPlayer.currentTime >= beatmap.metadata.duration && processedNotes.size >= notes.length) {
            stop();
            if (onGameEnd) onGameEnd();
            return;
        }

        rafId = requestAnimationFrame(update);
    }

    function start() {
        if (running) return;
        computePositions();
        running = true;
        inputEnabled = true;
        rafId = requestAnimationFrame(update);
    }

    /**
     * Freeze phase: draw notes at a fixed position ~100px above receptor.
     * Player gets `duration` seconds to analyze the first batch.
     * After that, music and falling start simultaneously, perfectly synchronized.
     *
     * @param {number} duration - Seconds to freeze (e.g. 3).
     * @param {function} onComplete - Called when freeze ends (start audio here).
     */
    function startFreeze(duration, onComplete) {
        computePositions();
        running = true;
        inputEnabled = false;

        // Calculate the audio time where the first note sits at FREEZE_OFFSET_PX above receptor
        const notes = beatmap.notes;
        let freezeTime = 0;
        if (notes.length > 0) {
            // y = receptorY - (note.time - freezeTime) * NOTE_SPEED
            // We want y = receptorY - FREEZE_OFFSET_PX for the first note
            // => FREEZE_OFFSET_PX = (note.time - freezeTime) * NOTE_SPEED
            // => freezeTime = note.time - FREEZE_OFFSET_PX / NOTE_SPEED
            freezeTime = Math.max(0, notes[0].time - FREEZE_OFFSET_PX / NOTE_SPEED);
        }

        // Position notes once at freezeTime — they stay frozen
        positionFrozen(freezeTime);

        const startTs = performance.now();

        function tick() {
            if (!running) return;

            const elapsed = (performance.now() - startTs) / 1000;
            if (elapsed >= duration) {
                // Freeze over — clean slate, seek audio to freezeTime
                clearAllNotes();
                processedNotes.clear();
                visibleNotes.clear();

                audioPlayer.seek(freezeTime);
                inputEnabled = true;
                rafId = requestAnimationFrame(update);
                if (onComplete) onComplete();
                return;
            }

            rafId = requestAnimationFrame(tick);
        }

        rafId = requestAnimationFrame(tick);
    }

    function stop() {
        running = false;
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }

    /**
     * Try to hit a note on a specific lane at the current audio time.
     * @param {number} lane - Lane index (0-3).
     * @returns {{ hit: boolean, noteIndex?: number, delta?: number, note?: object }}
     */
    function tryHit(lane) {
        if (!inputEnabled) return { hit: false };

        const currentTime = audioPlayer.currentTime;
        const notes = beatmap.notes;

        let bestIndex = -1;
        let bestDelta = Infinity;

        for (let i = 0; i < notes.length; i++) {
            if (processedNotes.has(i)) continue;
            if (notes[i].track !== lane) continue;
            if (!visibleNotes.has(i)) continue;

            const delta = Math.abs(notes[i].time - currentTime);
            if (delta < bestDelta) {
                bestDelta = delta;
                bestIndex = i;
            }
        }

        if (bestIndex === -1) return { hit: false };
        if (bestDelta > HIT_WINDOW) return { hit: false };

        return {
            hit: true,
            noteIndex: bestIndex,
            delta: bestDelta,
            note: notes[bestIndex],
        };
    }

    function markHit(noteIndex) {
        processedNotes.add(noteIndex);
        visibleNotes.delete(noteIndex);
        despawnNote(noteIndex);

        const lane = beatmap.notes[noteIndex].track;
        flashReceptor(lane);
    }

    function getProgress() {
        if (!beatmap.metadata.duration) return 0;
        return Math.min(1, audioPlayer.currentTime / beatmap.metadata.duration);
    }

    return {
        start,
        stop,
        startFreeze,
        tryHit,
        markHit,
        getProgress,
        get running() { return running; },
    };
}
