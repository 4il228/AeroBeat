/**
 * AeroBeat — Audio Analyzer
 * Frequency-band energy analysis, onset detection, beatmap generation.
 *
 * Approach:
 *   - Separate audio into 4 frequency bands (low, mid, snare, hi)
 *   - Detect energy peaks (onsets) in each band independently
 *   - Each onset becomes a note; lane = band index (low→D, mid→F, snare→J, hi→K)
 *   - Notes are tied to actual sounds in the music, not a BPM grid
 */

const CACHE_PREFIX = 'aerobeat_beatmap_';

const WINDOW_SIZE = 2048;
const HOP_SIZE = 1024;

/** Minimum gap between notes on the same lane (seconds) */
const LANE_MIN_GAP = 0.09;

/** Minimum gap between ANY two notes (seconds) */
const GLOBAL_MIN_GAP = 0.04;

// ─── Cache ───────────────────────────────────────────────────────────────────

function hashStr(str) {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) + hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return (hash >>> 0).toString(36);
}

function cacheKey(file) {
    return CACHE_PREFIX + hashStr(file.name + file.size + file.lastModified);
}

function storageAvailable() {
    try {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch { return false; }
}

export function getCachedBeatmap(file) {
    if (!storageAvailable()) return null;
    try {
        const raw = localStorage.getItem(cacheKey(file));
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

export function cacheBeatmap(file, beatmap) {
    if (!storageAvailable()) return;
    try { localStorage.setItem(cacheKey(file), JSON.stringify(beatmap)); }
    catch { /* quota exceeded */ }
}

async function decodeFile(ctx, file) {
    return ctx.decodeAudioData(await file.arrayBuffer());
}

// ─── IIR Filtering ───────────────────────────────────────────────────────────

function lowpassCoeffs(fc, fs) {
    const w = (2 * Math.PI * fc) / fs;
    const c = Math.cos(w), a = Math.sin(w) / Math.SQRT2, d = 1 + a;
    return { b0: ((1 - c) / 2) / d, b1: (1 - c) / d, b2: ((1 - c) / 2) / d, a1: (-2 * c) / d, a2: (1 - a) / d };
}

function applyIIR(samples, coeffs) {
    const out = new Float32Array(samples.length);
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let i = 0; i < samples.length; i++) {
        const x0 = samples[i];
        out[i] = coeffs.b0 * x0 + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * y1 - coeffs.a2 * y2;
        x2 = x1; x1 = x0; y2 = y1; y1 = out[i];
    }
    return out;
}

function separateBands(samples, sr) {
    const low = applyIIR(samples, lowpassCoeffs(200, sr));
    const lp2500 = applyIIR(samples, lowpassCoeffs(2500, sr));
    const lp6000 = applyIIR(samples, lowpassCoeffs(6000, sr));
    const mid = new Float32Array(samples.length);
    const snare = new Float32Array(samples.length);
    const hi = new Float32Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
        mid[i] = lp2500[i] - low[i];
        snare[i] = lp6000[i] - lp2500[i];
        hi[i] = samples[i] - lp6000[i];
    }
    return { low, mid, snare, hi };
}

// ─── Energy ──────────────────────────────────────────────────────────────────

function computeRMS(samples, sr, winSize, hop) {
    const energy = [], times = [];
    const total = Math.floor((samples.length - winSize) / hop) + 1;
    for (let w = 0; w < total; w++) {
        const off = w * hop;
        let sum = 0;
        for (let i = 0; i < winSize; i++) { const s = samples[off + i] || 0; sum += s * s; }
        energy.push(Math.sqrt(sum / winSize));
        times.push((off + winSize / 2) / sr);
    }
    return { energy, times };
}

// ─── Onset Detection ─────────────────────────────────────────────────────────

/**
 * Detect energy peaks in a band's RMS curve.
 * Adaptive threshold: peak must exceed local mean by a factor.
 * @param {number[]} energy - RMS energy array.
 * @param {number[]} times - Corresponding time stamps.
 * @param {number} minGap - Minimum seconds between consecutive onsets.
 * @returns {number[]} Array of onset times.
 */
function detectOnsets(energy, times, minGap) {
    if (energy.length === 0) return [];

    const winSize = 20;
    const h = (winSize - 1) >> 1;
    const onsets = [];

    for (let i = 2; i < energy.length - 1; i++) {
        let sum = 0, c = 0;
        for (let j = Math.max(0, i - h); j <= Math.min(energy.length - 1, i + h); j++) {
            sum += energy[j]; c++;
        }
        const localMean = sum / c;
        const threshold = localMean * 1.15;

        if (energy[i] > threshold &&
            energy[i] > energy[i - 1] &&
            energy[i] >= energy[i + 1]) {
            const t = times[i];
            if (onsets.length === 0 || t - onsets[onsets.length - 1] >= minGap) {
                onsets.push(t);
            }
        }
    }
    return onsets;
}

// ─── BPM Detection (for metadata only) ──────────────────────────────────────

function detectBPM(kickEnergy, effSR) {
    if (kickEnergy.length < 4) return 120;
    const mean = kickEnergy.reduce((a, b) => a + b, 0) / kickEnergy.length;
    const centered = kickEnergy.map(v => v - mean);

    const minLag = Math.floor((60 / 200) * effSR);
    const maxLag = Math.ceil((60 / 60) * effSR);

    let bestCorr = -Infinity, bestLag = minLag;
    for (let lag = minLag; lag <= maxLag && lag < centered.length; lag++) {
        let corr = 0, norm = 0;
        for (let i = 0; i < centered.length - lag; i++) {
            corr += centered[i] * centered[i + lag];
            norm += centered[i] * centered[i];
        }
        if (norm > 0) corr /= norm;
        if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
    }

    return Math.round(60 / (bestLag / effSR));
}

// ─── Main: Build Beatmap (onset-based) ──────────────────────────────────────

/**
 * Build beatmap from detected onsets in each frequency band.
 * Lane assignment: low(0-200Hz)→0(D), mid(200-2500Hz)→1(F),
 *                  snare(2500-6000Hz)→2(J), hi(6000Hz+)→3(K).
 * @param {{ energy: number[], times: number[] }} kickRMS
 * @param {{ energy: number[], times: number[] }} midRMS
 * @param {{ energy: number[], times: number[] }} snareRMS
 * @param {{ energy: number[], times: number[] }} hiRMS
 * @returns {{ time: number, track: number }[]}
 */
function buildBeatmap(kickRMS, midRMS, snareRMS, hiRMS) {
    const kickOnsets = detectOnsets(kickRMS.energy, kickRMS.times, LANE_MIN_GAP);
    const midOnsets = detectOnsets(midRMS.energy, midRMS.times, LANE_MIN_GAP);
    const snareOnsets = detectOnsets(snareRMS.energy, snareRMS.times, LANE_MIN_GAP);
    const hiOnsets = detectOnsets(hiRMS.energy, hiRMS.times, LANE_MIN_GAP);

    const notes = [];
    for (const t of kickOnsets) notes.push({ time: Math.round(t * 1000) / 1000, track: 0 });
    for (const t of midOnsets) notes.push({ time: Math.round(t * 1000) / 1000, track: 1 });
    for (const t of snareOnsets) notes.push({ time: Math.round(t * 1000) / 1000, track: 2 });
    for (const t of hiOnsets) notes.push({ time: Math.round(t * 1000) / 1000, track: 3 });

    notes.sort((a, b) => a.time - b.time);

    const filtered = [];
    for (const note of notes) {
        if (filtered.length === 0 || note.time - filtered[filtered.length - 1].time >= GLOBAL_MIN_GAP) {
            filtered.push(note);
        }
    }

    return filtered;
}

// ─── Entry Point ─────────────────────────────────────────────────────────────

export async function generateBeatmap(file, onProgress) {
    const cached = getCachedBeatmap(file);
    if (cached) { if (onProgress) onProgress(1); return cached; }

    if (onProgress) onProgress(0.05);
    const ctx = new AudioContext();
    try {
        const buffer = await decodeFile(ctx, file);
        if (onProgress) onProgress(0.15);

        const samples = buffer.getChannelData(0);
        const sr = buffer.sampleRate;

        const bands = separateBands(samples, sr);
        if (onProgress) onProgress(0.25);

        const kickRMS = computeRMS(bands.low, sr, WINDOW_SIZE, HOP_SIZE);
        const midRMS = computeRMS(bands.mid, sr, WINDOW_SIZE, HOP_SIZE);
        const snareRMS = computeRMS(bands.snare, sr, WINDOW_SIZE, HOP_SIZE);
        const hiRMS = computeRMS(bands.hi, sr, WINDOW_SIZE, HOP_SIZE);
        if (onProgress) onProgress(0.5);

        const effSR = sr / HOP_SIZE;
        const bpm = detectBPM(kickRMS.energy, effSR);
        if (onProgress) onProgress(0.7);

        const notes = buildBeatmap(kickRMS, midRMS, snareRMS, hiRMS);
        if (onProgress) onProgress(0.95);

        const beatmap = {
            metadata: {
                title: file.name.replace(/\.[^.]+$/, ''),
                artist: 'Unknown',
                bpm,
                offset: 0,
                duration: buffer.duration,
            },
            notes,
        };

        cacheBeatmap(file, beatmap);
        if (onProgress) onProgress(1);
        return beatmap;
    } finally {
        ctx.close();
    }
}
