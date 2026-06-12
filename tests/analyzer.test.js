import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateBeatmap, getCachedBeatmap, cacheBeatmap } from '../js/audio/analyzer.js';

// Polyfill localStorage for Node.js test environment
const localStorageMock = (() => {
    let store = {};
    return {
        getItem: (key) => store[key] ?? null,
        setItem: (key, value) => { store[key] = String(value); },
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (i) => Object.keys(store)[i] ?? null,
    };
})();
vi.stubGlobal('localStorage', localStorageMock);

// Polyfill File for Node.js test environment
class MockFile {
    constructor(parts, name, options = {}) {
        this._parts = parts;
        this.name = name;
        this.type = options.type || '';
        this.size = parts.reduce((acc, p) => acc + (typeof p === 'string' ? p.length : p.byteLength), 0);
        this.lastModified = options.lastModified || Date.now();
    }
    async arrayBuffer() {
        const chunks = this._parts.map(p =>
            typeof p === 'string' ? new TextEncoder().encode(p) : new Uint8Array(p)
        );
        const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
        const result = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            result.set(chunk, offset);
            offset += chunk.length;
        }
        return result.buffer;
    }
}
vi.stubGlobal('File', MockFile);

// Mock Web Audio API
class MockAudioBuffer {
    constructor(channels, length, sampleRate) {
        this.numberOfChannels = channels;
        this.length = length;
        this.sampleRate = sampleRate;
        this.duration = length / sampleRate;
        this._channels = [];
        for (let c = 0; c < channels; c++) {
            this._channels.push(new Float32Array(length));
        }
    }
    getChannelData(channel) {
        return this._channels[channel];
    }
}

// Generate a sine wave with impulses at known times
function generateMetronomeBuffer(sampleRate, duration, bpm) {
    const length = Math.floor(sampleRate * duration);
    const buffer = new MockAudioBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    const interval = 60 / bpm;
    const impulseSamples = Math.floor(0.01 * sampleRate);

    for (let t = 0; t < duration; t += interval) {
        const start = Math.floor(t * sampleRate);
        for (let i = 0; i < impulseSamples && start + i < length; i++) {
            data[start + i] = 0.8;
        }
    }
    return buffer;
}

describe('Analyzer', () => {
    let mockCtx;

    beforeEach(() => {
        vi.stubGlobal('AudioContext', class {
            constructor() {
                mockCtx = this;
            }
            decodeAudioData(arrayBuffer) {
                return Promise.resolve(
                    generateMetronomeBuffer(44100, 5, 120)
                );
            }
            close() {}
        });
        localStorage.clear();
    });

    describe('generateBeatmap', () => {
        it('returns beatmap with metadata and notes', async () => {
            const file = new File(['test'], 'test.mp3', { type: 'audio/mpeg' });
            const beatmap = await generateBeatmap(file);

            expect(beatmap).toHaveProperty('metadata');
            expect(beatmap).toHaveProperty('notes');
            expect(beatmap.metadata.bpm).toBeGreaterThan(0);
            expect(Array.isArray(beatmap.notes)).toBe(true);
        });

        it('generates notes with time and track', async () => {
            const file = new File(['test'], 'test.mp3', { type: 'audio/mpeg' });
            const beatmap = await generateBeatmap(file);

            for (const note of beatmap.notes) {
                expect(note).toHaveProperty('time');
                expect(note).toHaveProperty('track');
                expect(typeof note.time).toBe('number');
                expect(note.track).toBeGreaterThanOrEqual(0);
                expect(note.track).toBeLessThan(4);
            }
        });

        it('reports progress via callback', async () => {
            const file = new File(['test'], 'test.mp3', { type: 'audio/mpeg' });
            const progress = [];
            await generateBeatmap(file, (p) => progress.push(p));

            expect(progress.length).toBeGreaterThan(0);
            expect(progress[progress.length - 1]).toBe(1);
        });
    });

    describe('Caching', () => {
        it('returns cached beatmap on second call', async () => {
            const file = new File(['data'], 'cached.mp3', { type: 'audio/mpeg' });

            const first = await generateBeatmap(file);
            const second = await generateBeatmap(file);

            expect(second).toEqual(first);
        });

        it('getCachedBeatmap returns null for uncached file', () => {
            const file = new File(['data'], 'new.mp3', { type: 'audio/mpeg' });
            expect(getCachedBeatmap(file)).toBeNull();
        });

        it('cacheBeatmap stores and retrieves', () => {
            const file = new File(['data'], 'store.mp3', { type: 'audio/mpeg' });
            const beatmap = { metadata: { bpm: 120 }, notes: [] };

            cacheBeatmap(file, beatmap);
            const cached = getCachedBeatmap(file);

            expect(cached).toEqual(beatmap);
        });
    });
});
