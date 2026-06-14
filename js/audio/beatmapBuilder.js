/**
 * AeroBeat — Beatmap Builder
 * Grid-first auto-mapper: detects BPM, builds musical grid,
 * scores energy at grid points, and generates playable beatmaps.
 *
 * Pipeline: Downmix → Band Isolation → Envelope → BPM Detection
 *         → Grid Scoring → Density Control → Pattern Generation
 */

/** @returns {Promise<void>} */
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

/**
 * Apply a biquad low-pass filter to PCM samples.
 * @param {Float32Array} input
 * @param {number} cutoffHz
 * @param {number} sampleRate
 * @returns {Float32Array}
 */
export function lowPassFilter(input, cutoffHz, sampleRate) {
    const rc = 1.0 / (cutoffHz * 2 * Math.PI);
    const dt = 1.0 / sampleRate;
    const alpha = dt / (rc + dt);
    const output = new Float32Array(input.length);
    output[0] = input[0];
    for (let i = 1; i < input.length; i++) {
        output[i] = output[i - 1] + alpha * (input[i] - output[i - 1]);
    }
    return output;
}

/**
 * Apply a biquad high-pass filter to PCM samples.
 * @param {Float32Array} input
 * @param {number} cutoffHz
 * @param {number} sampleRate
 * @returns {Float32Array}
 */
export function highPassFilter(input, cutoffHz, sampleRate) {
    const rc = 1.0 / (cutoffHz * 2 * Math.PI);
    const dt = 1.0 / sampleRate;
    const alpha = rc / (rc + dt);
    const output = new Float32Array(input.length);
    output[0] = input[0];
    for (let i = 1; i < input.length; i++) {
        output[i] = alpha * (output[i - 1] + input[i] - input[i - 1]);
    }
    return output;
}

/**
 * Apply a biquad band-pass filter to PCM samples.
 * @param {Float32Array} input
 * @param {number} lowCutoffHz
 * @param {number} highCutoffHz
 * @param {number} sampleRate
 * @returns {Float32Array}
 */
export function bandPassFilter(input, lowCutoffHz, highCutoffHz, sampleRate) {
    const highPassed = highPassFilter(input, lowCutoffHz, sampleRate);
    return lowPassFilter(highPassed, highCutoffHz, sampleRate);
}

/**
 * Compute amplitude envelope with rectification and IIR smoothing.
 * @param {Float32Array} samples
 * @param {number} alpha - Smoothing factor (0-1, lower = smoother)
 * @returns {Float32Array}
 */
export function computeEnvelope(samples, alpha = 0.05) {
    const envelope = new Float32Array(samples.length);
    envelope[0] = Math.abs(samples[0]);
    for (let i = 1; i < samples.length; i++) {
        const rectified = Math.abs(samples[i]);
        envelope[i] = envelope[i - 1] + alpha * (rectified - envelope[i - 1]);
    }
    return envelope;
}

/**
 * Downmix stereo AudioBuffer to mono Float32Array.
 * @param {AudioBuffer} audioBuffer
 * @returns {Float32Array}
 */
export function downmixToMono(audioBuffer) {
    const length = audioBuffer.length;
    const channels = audioBuffer.numberOfChannels;
    const mono = new Float32Array(length);

    for (let ch = 0; ch < channels; ch++) {
        const data = audioBuffer.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            mono[i] += data[i] / channels;
        }
    }

    return mono;
}

/**
 * Downsample a Float32Array using max-pooling (preserves peaks).
 * @param {Float32Array} input
 * @param {number} factor
 * @returns {Float32Array}
 */
function downsample(input, factor) {
    const outLen = Math.ceil(input.length / factor);
    const output = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
        let max = 0;
        const start = i * factor;
        const end = Math.min(start + factor, input.length);
        for (let j = start; j < end; j++) {
            if (input[j] > max) max = input[j];
        }
        output[i] = max;
    }
    return output;
}

/**
 * Detect BPM using autocorrelation on a downsampled onset signal.
 * Includes harmonic detection to prefer faster tempos when correlations are similar.
 * @param {Float32Array} kickOnset - Onset detection function for kick band
 * @param {number} sampleRate
 * @returns {{ bpm: number, confidence: number }}
 */
export function detectBPM(kickOnset, sampleRate) {
    const DOWNSAMPLE = 50;
    const ds = downsample(kickOnset, DOWNSAMPLE);
    const dsRate = sampleRate / DOWNSAMPLE;

    const minBPM = 60;
    const maxBPM = 200;
    const minLag = Math.floor((60 / maxBPM) * dsRate);
    const maxLag = Math.floor((60 / minBPM) * dsRate);

    let bestLag = minLag;
    let bestCorr = -Infinity;

    for (let lag = minLag; lag <= maxLag; lag++) {
        let corr = 0;
        let count = 0;
        for (let i = 0; i < ds.length - lag; i++) {
            corr += ds[i] * ds[i + lag];
            count++;
        }
        corr /= count;

        if (corr > bestCorr) {
            bestCorr = corr;
            bestLag = lag;
        }
    }

    // Harmonic check: if the half-lag (double BPM) has >= 80% correlation, prefer it
    const halfLag = Math.round(bestLag / 2);
    if (halfLag >= minLag) {
        let halfCorr = 0;
        let count = 0;
        for (let i = 0; i < ds.length - halfLag; i++) {
            halfCorr += ds[i] * ds[i + halfLag];
            count++;
        }
        halfCorr /= count;

        if (halfCorr >= bestCorr * 0.8) {
            bestLag = halfLag;
            bestCorr = halfCorr;
        }
    }

    const bpm = 60 / (bestLag / dsRate);
    const confidence = bestCorr;

    return { bpm, confidence };
}

/**
 * Detect the offset (first strong kick) in the onset signal.
 * @param {Float32Array} kickOnset
 * @param {number} sampleRate
 * @param {number} bpm
 * @returns {number} Offset in seconds
 */
export function detectOffset(kickOnset, sampleRate, bpm) {
    const beatInterval = 60 / bpm;
    const threshold = 0.3;

    for (let i = 0; i < kickOnset.length; i++) {
        if (kickOnset[i] > threshold) {
            const time = i / sampleRate;
            return time % beatInterval;
        }
    }

    return 0;
}

/**
 * Compute onset detection function (first derivative + half-wave rectification).
 * @param {Float32Array} envelope
 * @returns {Float32Array}
 */
export function computeOnset(envelope) {
    const onset = new Float32Array(envelope.length);
    for (let i = 1; i < envelope.length; i++) {
        const diff = envelope[i] - envelope[i - 1];
        onset[i] = diff > 0 ? diff : 0;
    }
    return onset;
}

/**
 * Sample the maximum energy in a window around a time point.
 * @param {Float32Array} envelope
 * @param {number} timeSec
 * @param {number} sampleRate
 * @param {number} windowMs - Window size in milliseconds
 * @returns {number}
 */
export function sampleEnergy(envelope, timeSec, sampleRate, windowMs = 40) {
    const center = Math.round(timeSec * sampleRate);
    const halfWindow = Math.round((windowMs / 1000) * sampleRate / 2);
    const start = Math.max(0, center - halfWindow);
    const end = Math.min(envelope.length - 1, center + halfWindow);

    let maxVal = 0;
    for (let i = start; i <= end; i++) {
        if (envelope[i] > maxVal) maxVal = envelope[i];
    }
    return maxVal;
}

/**
 * Find the maximum value in a Float32Array.
 * @param {Float32Array} data
 * @param {number} [step=1] - Sample every N-th element for speed.
 * @returns {number}
 */
function findMax(data, step = 1) {
    let max = 0;
    for (let i = 0; i < data.length; i += step) {
        if (data[i] > max) max = data[i];
    }
    return max;
}

/**
 * Main beatmap generation pipeline.
 * @param {AudioBuffer} audioBuffer - Decoded audio buffer.
 * @param {function(number): void} [onProgress] - Progress callback (0-1).
 * @returns {Promise<object>} Beatmap object.
 */
export async function buildBeatmap(audioBuffer, onProgress) {
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;

    // Phase 1: Downmix to mono
    if (onProgress) onProgress(0.05);
    const mono = downmixToMono(audioBuffer);

    // Phase 2: Multi-band isolation
    if (onProgress) onProgress(0.10);
    const kick = lowPassFilter(mono, 120, sampleRate);

    if (onProgress) onProgress(0.15);
    const snare = bandPassFilter(mono, 1000, 3000, sampleRate);

    if (onProgress) onProgress(0.20);
    const hihat = highPassFilter(mono, 6000, sampleRate);

    await yieldToMain();

    // Compute envelopes
    if (onProgress) onProgress(0.25);
    const kickEnv = computeEnvelope(kick, 0.05);

    if (onProgress) onProgress(0.30);
    const snareEnv = computeEnvelope(snare, 0.05);

    if (onProgress) onProgress(0.35);
    const hihatEnv = computeEnvelope(hihat, 0.05);

    await yieldToMain();

    // Phase 3: BPM detection
    if (onProgress) onProgress(0.40);
    const kickOnset = computeOnset(kickEnv);

    const { bpm, confidence } = detectBPM(kickOnset, sampleRate);
    const offset = detectOffset(kickOnset, sampleRate, bpm);

    await yieldToMain();

    // Phase 4: Grid generation & energy scoring
    if (onProgress) onProgress(0.50);
    const beatInterval = 60 / bpm;
    const nodes = [];

    for (let t = offset; t < duration; t += beatInterval / 4) {
        const posInBeat = ((t - offset) % beatInterval) / beatInterval;
        let gridLevel;
        if (posInBeat < 0.01 || Math.abs(posInBeat - 0.5) < 0.01) {
            gridLevel = 'quarter';
        } else if (Math.abs(posInBeat - 0.25) < 0.01 || Math.abs(posInBeat - 0.75) < 0.01) {
            gridLevel = 'eighth';
        } else {
            gridLevel = 'sixteenth';
        }

        const kickE = sampleEnergy(kickEnv, t, sampleRate);
        const snareE = sampleEnergy(snareEnv, t, sampleRate);
        const hihatE = sampleEnergy(hihatEnv, t, sampleRate);

        nodes.push({ time: t, gridLevel, kickE, snareE, hihatE });
    }

    // Phase 5: Scoring & density control
    if (onProgress) onProgress(0.65);

    const maxKick = findMax(kickEnv, 1000);
    const maxSnare = findMax(snareEnv, 1000);
    const maxHihat = findMax(hihatEnv, 1000);

    const W_KICK = 1.0;
    const W_SNARE = 0.8;
    const W_HIHAT = 0.3;

    const thresholds = {
        quarter: 0.08,
        eighth: 0.18,
        sixteenth: 0.35,
    };

    const scoredNodes = [];
    let densityPenalty = 0;

    for (const node of nodes) {
        const kN = maxKick > 0 ? node.kickE / maxKick : 0;
        const sN = maxSnare > 0 ? node.snareE / maxSnare : 0;
        const hN = maxHihat > 0 ? node.hihatE / maxHihat : 0;

        let score = W_KICK * kN + W_SNARE * sN + W_HIHAT * hN;
        score -= densityPenalty;

        const threshold = thresholds[node.gridLevel];
        if (score > threshold) {
            scoredNodes.push({
                ...node,
                score,
                kickNorm: kN,
                snareNorm: sN,
                hihatNorm: hN,
            });

            if (node.gridLevel === 'eighth') {
                densityPenalty += 0.03;
            } else if (node.gridLevel === 'sixteenth') {
                densityPenalty += 0.06;
            }
        } else {
            densityPenalty = Math.max(0, densityPenalty - 0.01);
        }
    }

    await yieldToMain();

    // Phase 6: Pattern generation (D F J K)
    if (onProgress) onProgress(0.80);

    const notes = [];
    let lastLeftLane = -1;
    let lastRightLane = -1;
    let lastNoteTime = -Infinity;

    for (const node of scoredNodes) {
        const isDense = (node.time - lastNoteTime) < beatInterval / 4;
        lastNoteTime = node.time;

        const dominantKick = node.kickNorm > node.snareNorm;
        const extremeScore = node.score > 0.6;

        if (extremeScore && node.kickNorm > 0.4 && node.snareNorm > 0.4) {
            notes.push({ time: node.time, track: 0 });
            notes.push({ time: node.time, track: 3 });
            lastLeftLane = 0;
            lastRightLane = 3;
        } else if (dominantKick) {
            let lane;
            if (isDense && lastLeftLane === 1) {
                lane = 0;
            } else if (isDense && lastLeftLane === 0) {
                lane = 1;
            } else {
                lane = lastLeftLane === 0 ? 1 : 0;
            }
            notes.push({ time: node.time, track: lane });
            lastLeftLane = lane;
        } else {
            let lane;
            if (isDense && lastRightLane === 3) {
                lane = 2;
            } else if (isDense && lastRightLane === 2) {
                lane = 3;
            } else {
                lane = lastRightLane === 3 ? 2 : 3;
            }
            notes.push({ time: node.time, track: lane });
            lastRightLane = lane;
        }
    }

    // Phase 7: Build output
    if (onProgress) onProgress(0.95);

    notes.sort((a, b) => a.time - b.time);

    const noteCount = notes.length;
    let density = 'Low';
    if (noteCount > 0) {
        const notesPerSecond = noteCount / duration;
        if (notesPerSecond > 4) density = 'High';
        else if (notesPerSecond > 2) density = 'Medium';
    }

    const beatmap = {
        version: 2,
        metadata: {
            bpm: Math.round(bpm * 10) / 10,
            offset: Math.round(offset * 1000) / 1000,
            noteCount,
            density,
            duration: Math.round(duration * 100) / 100,
        },
        notes,
    };

    if (onProgress) onProgress(1.0);
    await yieldToMain();

    return beatmap;
}
