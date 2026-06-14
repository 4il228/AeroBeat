import { describe, it, expect } from 'vitest';
import {
    lowPassFilter,
    highPassFilter,
    bandPassFilter,
    computeEnvelope,
    downmixToMono,
    detectBPM,
    detectOffset,
    computeOnset,
    sampleEnergy,
    buildBeatmap,
} from '../js/audio/beatmapBuilder.js';

/**
 * Create a mock AudioBuffer for testing.
 * @param {number} sampleRate
 * @param {number} durationSec
 * @param {Float32Array[]} channelData
 * @returns {{ length: number, duration: number, numberOfChannels: number, sampleRate: number, getChannelData: (ch: number) => Float32Array }}
 */
function createMockAudioBuffer(sampleRate, durationSec, channelData) {
    const length = Math.round(sampleRate * durationSec);
    return {
        length,
        duration: durationSec,
        numberOfChannels: channelData.length,
        sampleRate,
        getChannelData(ch) {
            return channelData[ch];
        },
    };
}

/**
 * Generate a sine wave.
 * @param {number} freq
 * @param {number} sampleRate
 * @param {number} duration
 * @param {number} amplitude
 * @returns {Float32Array}
 */
function sineWave(freq, sampleRate, duration, amplitude = 1.0) {
    const length = Math.round(sampleRate * duration);
    const data = new Float32Array(length);
    for (let i = 0; i < length; i++) {
        data[i] = amplitude * Math.sin(2 * Math.PI * freq * i / sampleRate);
    }
    return data;
}

/**
 * Generate a metronome-like signal: periodic clicks.
 * @param {number} bpm
 * @param {number} sampleRate
 * @param {number} duration
 * @returns {Float32Array}
 */
function metronome(bpm, sampleRate, duration) {
    const length = Math.round(sampleRate * duration);
    const data = new Float32Array(length);
    const interval = Math.round((60 / bpm) * sampleRate);
    const clickLen = Math.round(0.005 * sampleRate); // 5ms click
    for (let pos = 0; pos < length; pos += interval) {
        for (let j = 0; j < clickLen && pos + j < length; j++) {
            data[pos + j] = Math.exp(-j / (clickLen * 0.2));
        }
    }
    return data;
}

describe('beatmapBuilder', () => {
    describe('lowPassFilter', () => {
        it('passes low-frequency signals', () => {
            const sr = 44100;
            const data = sineWave(50, sr, 0.1);
            const filtered = lowPassFilter(data, 120, sr);
            // Low freq signal should pass through mostly unchanged
            const energy = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
            const origEnergy = data.reduce((s, v) => s + v * v, 0) / data.length;
            expect(energy / origEnergy).toBeGreaterThan(0.5);
        });

        it('attenuates high-frequency signals', () => {
            const sr = 44100;
            const data = sineWave(5000, sr, 0.1);
            const filtered = lowPassFilter(data, 120, sr);
            const energy = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
            const origEnergy = data.reduce((s, v) => s + v * v, 0) / data.length;
            expect(energy / origEnergy).toBeLessThan(0.1);
        });
    });

    describe('highPassFilter', () => {
        it('passes high-frequency signals', () => {
            const sr = 44100;
            const data = sineWave(8000, sr, 0.1);
            const filtered = highPassFilter(data, 6000, sr);
            const energy = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
            const origEnergy = data.reduce((s, v) => s + v * v, 0) / data.length;
            expect(energy / origEnergy).toBeGreaterThan(0.3);
        });

        it('attenuates low-frequency signals', () => {
            const sr = 44100;
            const data = sineWave(100, sr, 0.1);
            const filtered = highPassFilter(data, 6000, sr);
            const energy = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
            const origEnergy = data.reduce((s, v) => s + v * v, 0) / data.length;
            expect(energy / origEnergy).toBeLessThan(0.1);
        });
    });

    describe('bandPassFilter', () => {
        it('passes signals in the passband', () => {
            const sr = 44100;
            const data = sineWave(2000, sr, 0.1);
            const filtered = bandPassFilter(data, 1000, 3000, sr);
            const energy = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
            const origEnergy = data.reduce((s, v) => s + v * v, 0) / data.length;
            expect(energy / origEnergy).toBeGreaterThan(0.3);
        });

        it('attenuates signals outside the passband', () => {
            const sr = 44100;
            const data = sineWave(100, sr, 0.1);
            const filtered = bandPassFilter(data, 1000, 3000, sr);
            const energy = filtered.reduce((s, v) => s + v * v, 0) / filtered.length;
            const origEnergy = data.reduce((s, v) => s + v * v, 0) / data.length;
            expect(energy / origEnergy).toBeLessThan(0.1);
        });
    });

    describe('computeEnvelope', () => {
        it('produces non-negative output', () => {
            const data = new Float32Array([0.5, -0.8, 0.3, -0.1, 0.9]);
            const env = computeEnvelope(data, 0.5);
            for (let i = 0; i < env.length; i++) {
                expect(env[i]).toBeGreaterThanOrEqual(0);
            }
        });

        it('smooths the signal over time', () => {
            const sr = 44100;
            const data = sineWave(1000, sr, 0.05);
            const env = computeEnvelope(data, 0.05);
            // Envelope should be smoother than raw rectified signal
            const envVariance = env.reduce((s, v, i) => i > 0 ? s + (v - env[i-1]) ** 2 : s, 0) / env.length;
            const rawVariance = data.reduce((s, v, i) => i > 0 ? s + (Math.abs(v) - Math.abs(data[i-1])) ** 2 : s, 0) / data.length;
            expect(envVariance).toBeLessThan(rawVariance);
        });
    });

    describe('computeOnset', () => {
        it('returns non-negative values', () => {
            const envelope = new Float32Array([0.1, 0.3, 0.2, 0.5, 0.4]);
            const onset = computeOnset(envelope);
            for (let i = 0; i < onset.length; i++) {
                expect(onset[i]).toBeGreaterThanOrEqual(0);
            }
        });

        it('detects rising edges', () => {
            const envelope = new Float32Array([0.0, 0.0, 0.5, 1.0]);
            const onset = computeOnset(envelope);
            expect(onset[1]).toBe(0);     // no rise
            expect(onset[2]).toBeCloseTo(0.5, 1); // rise
            expect(onset[3]).toBeCloseTo(0.5, 1); // rise
        });

        it('returns zero for falling edges', () => {
            const envelope = new Float32Array([1.0, 0.5, 0.0]);
            const onset = computeOnset(envelope);
            expect(onset[1]).toBe(0); // falling
            expect(onset[2]).toBe(0); // falling
        });
    });

    describe('sampleEnergy', () => {
        it('returns max energy in window', () => {
            const sr = 44100;
            const data = new Float32Array(sr);
            // Put a spike at 0.5 seconds
            const center = Math.round(0.5 * sr);
            data[center] = 1.0;
            expect(sampleEnergy(data, 0.5, sr, 40)).toBeCloseTo(1.0, 2);
        });

        it('returns 0 for silent signal', () => {
            const sr = 44100;
            const data = new Float32Array(sr);
            expect(sampleEnergy(data, 0.5, sr, 40)).toBe(0);
        });
    });

    describe('detectBPM', () => {
        it('detects BPM of a metronome signal', () => {
            const sr = 44100;
            const bpm = 120;
            const metro = metronome(bpm, sr, 5);
            const env = computeEnvelope(metro, 0.05);
            const onset = computeOnset(env);
            const result = detectBPM(onset, sr);
            // Should detect within ±5 BPM
            expect(Math.abs(result.bpm - bpm)).toBeLessThan(5);
        });

        it('detects a different BPM', () => {
            const sr = 44100;
            const bpm = 90;
            const metro = metronome(bpm, sr, 5);
            const env = computeEnvelope(metro, 0.05);
            const onset = computeOnset(env);
            const result = detectBPM(onset, sr);
            expect(Math.abs(result.bpm - bpm)).toBeLessThan(5);
        });
    });

    describe('detectOffset', () => {
        it('finds the first strong onset', () => {
            const sr = 44100;
            const onset = new Float32Array(sr * 2);
            // First strong onset at 0.25 seconds
            const idx = Math.round(0.25 * sr);
            onset[idx] = 0.8;
            const offset = detectOffset(onset, sr, 120);
            expect(offset).toBeGreaterThanOrEqual(0);
            expect(offset).toBeLessThan(1);
        });
    });

    describe('downmixToMono', () => {
        it('averages stereo channels', () => {
            const sr = 44100;
            const length = sr;
            const left = new Float32Array(length);
            const right = new Float32Array(length);
            left[0] = 1.0;
            right[0] = -1.0;
            const buf = createMockAudioBuffer(sr, 1, [left, right]);
            const mono = downmixToMono(buf);
            expect(mono[0]).toBeCloseTo(0.0, 5);
        });

        it('handles mono input', () => {
            const sr = 44100;
            const data = new Float32Array(sr);
            data[0] = 0.5;
            const buf = createMockAudioBuffer(sr, 1, [data]);
            const mono = downmixToMono(buf);
            expect(mono[0]).toBeCloseTo(0.5, 5);
        });
    });

    describe('buildBeatmap', () => {
        it('returns a valid beatmap structure', async () => {
            const sr = 44100;
            const duration = 4;
            // Create a signal with 120 BPM clicks in the kick range
            const kickSignal = metronome(120, sr, duration);
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [kickSignal, silence]);

            const beatmap = await buildBeatmap(buf);

            expect(beatmap).toHaveProperty('version', 2);
            expect(beatmap).toHaveProperty('metadata');
            expect(beatmap).toHaveProperty('notes');
            expect(beatmap.metadata).toHaveProperty('bpm');
            expect(beatmap.metadata).toHaveProperty('offset');
            expect(beatmap.metadata).toHaveProperty('noteCount');
            expect(beatmap.metadata).toHaveProperty('density');
            expect(beatmap.metadata).toHaveProperty('duration');
            expect(Array.isArray(beatmap.notes)).toBe(true);
        });

        it('detects BPM within reasonable range', async () => {
            const sr = 44100;
            const duration = 6;
            const bpm = 128;
            const kickSignal = metronome(bpm, sr, duration);
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [kickSignal, silence]);

            const beatmap = await buildBeatmap(buf);

            expect(Math.abs(beatmap.metadata.bpm - bpm)).toBeLessThan(10);
        });

        it('generates notes for rhythmic input', async () => {
            const sr = 44100;
            const duration = 4;
            const bpm = 120;
            const kickSignal = metronome(bpm, sr, duration);
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [kickSignal, silence]);

            const beatmap = await buildBeatmap(buf);

            // Should generate at least some notes from a rhythmic signal
            expect(beatmap.notes.length).toBeGreaterThan(0);
        });

        it('calls onProgress with increasing values', async () => {
            const sr = 44100;
            const duration = 3;
            const kickSignal = metronome(120, sr, duration);
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [kickSignal, silence]);

            const progressValues = [];
            await buildBeatmap(buf, (p) => progressValues.push(p));

            expect(progressValues.length).toBeGreaterThan(0);
            expect(progressValues[progressValues.length - 1]).toBe(1.0);
            // Progress should be monotonically non-decreasing
            for (let i = 1; i < progressValues.length; i++) {
                expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
            }
        });

        it('notes are sorted by time', async () => {
            const sr = 44100;
            const duration = 4;
            const kickSignal = metronome(120, sr, duration);
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [kickSignal, silence]);

            const beatmap = await buildBeatmap(buf);

            for (let i = 1; i < beatmap.notes.length; i++) {
                expect(beatmap.notes[i].time).toBeGreaterThanOrEqual(beatmap.notes[i - 1].time);
            }
        });

        it('all notes have valid track values (0-3)', async () => {
            const sr = 44100;
            const duration = 4;
            const kickSignal = metronome(120, sr, duration);
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [kickSignal, silence]);

            const beatmap = await buildBeatmap(buf);

            for (const note of beatmap.notes) {
                expect(note.track).toBeGreaterThanOrEqual(0);
                expect(note.track).toBeLessThanOrEqual(3);
            }
        });

        it('handles silent input gracefully', async () => {
            const sr = 44100;
            const duration = 3;
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [silence, silence]);

            const beatmap = await buildBeatmap(buf);

            expect(beatmap).toHaveProperty('version', 2);
            expect(beatmap.notes.length).toBe(0);
            expect(beatmap.metadata.noteCount).toBe(0);
        });

        it('metadata.duration matches input duration', async () => {
            const sr = 44100;
            const duration = 5;
            const kickSignal = metronome(120, sr, duration);
            const silence = new Float32Array(sr * duration);
            const buf = createMockAudioBuffer(sr, duration, [kickSignal, silence]);

            const beatmap = await buildBeatmap(buf);

            expect(beatmap.metadata.duration).toBeCloseTo(duration, 1);
        });
    });
});
