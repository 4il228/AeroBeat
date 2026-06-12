/**
 * AeroBeat — Audio Player
 * Web Audio API-based player with precise currentTime tracking.
 * Provides play/pause/seek and sub-millisecond time accuracy.
 */

export class AudioPlayer {
    constructor() {
        /** @type {AudioContext|null} */
        this.ctx = null;
        /** @type {AudioBufferSourceNode|null} */
        this.source = null;
        /** @type {GainNode|null} */
        this.gainNode = null;
        /** @type {AudioBuffer|null} */
        this.buffer = null;
        /** @type {number} ctx.currentTime when play() was called */
        this.startTime = 0;
        /** @type {number} accumulated time from previous plays */
        this.pauseOffset = 0;
        /** @type {boolean} */
        this.playing = false;
        /** @type {number} Master volume 0–1 */
        this._volume = 1;
    }

    /**
     * Initialize AudioContext (call after user gesture).
     */
    init() {
        if (!this.ctx) {
            this.ctx = new AudioContext();
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.value = this._volume;
            this.gainNode.connect(this.ctx.destination);
        }
    }

    /**
     * Load audio file into buffer.
     * @param {File} file - Audio file from input.
     * @returns {Promise<void>}
     */
    async load(file) {
        this.init();
        const arrayBuffer = await file.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.pauseOffset = 0;
    }

    /**
     * Load audio from an ArrayBuffer (e.g. fetched from server URL).
     * @param {ArrayBuffer} arrayBuffer - Raw audio data.
     * @returns {Promise<void>}
     */
    async loadFromBuffer(arrayBuffer) {
        this.init();
        this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
        this.pauseOffset = 0;
    }

    /**
     * Start or resume playback.
     */
    async play() {
        if (!this.buffer || this.playing) return;

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.connect(this.gainNode);

        this.source.onended = () => {
            if (this.playing) {
                this.playing = false;
                this.pauseOffset = this.duration;
            }
        };

        this.source.start(0, this.pauseOffset);
        this.startTime = this.ctx.currentTime;
        this.playing = true;
    }

    /**
     * Stop playback and reset position.
     */
    stop() {
        if (!this.playing) return;
        this.source.stop();
        this.playing = false;
        this.pauseOffset = 0;
    }

    /**
     * Pause playback, preserving current position.
     */
    pause() {
        if (!this.playing) return;
        this.source.stop();
        this.pauseOffset = this.ctx.currentTime - this.startTime + this.pauseOffset;
        this.playing = false;
    }

    /**
     * Seek to a specific time.
     * @param {number} t - Time in seconds.
     */
    seek(t) {
        this.pauseOffset = Math.max(0, Math.min(t, this.duration));
        if (this.playing) {
            this.source.stop();
            this.source = this.ctx.createBufferSource();
            this.source.buffer = this.buffer;
            this.source.connect(this.gainNode);
            this.source.onended = () => {
                if (this.playing) {
                    this.playing = false;
                    this.pauseOffset = this.duration;
                }
            };
            this.source.start(0, this.pauseOffset);
            this.startTime = this.ctx.currentTime;
        }
    }

    /**
     * Get current playback time with sub-millisecond precision.
     * @type {number}
     */
    get currentTime() {
        if (!this.ctx) return 0;
        return this.playing
            ? this.ctx.currentTime - this.startTime + this.pauseOffset
            : this.pauseOffset;
    }

    /**
     * Get total audio duration.
     * @type {number}
     */
    get duration() {
        return this.buffer ? this.buffer.duration : 0;
    }

    /**
     * Set master volume (0–1).
     * @param {number} v
     */
    set volume(v) {
        this._volume = Math.max(0, Math.min(1, v));
        if (this.gainNode) {
            this.gainNode.gain.cancelScheduledValues(this.ctx.currentTime);
            this.gainNode.gain.setValueAtTime(this._volume, this.ctx.currentTime);
        }
    }

    /**
     * Get current master volume.
     * @type {number}
     */
    get volume() {
        return this._volume;
    }

    /**
     * Destroy player and release resources.
     */
    destroy() {
        if (this.source) {
            try { this.source.stop(); } catch (e) { /* already stopped */ }
        }
        if (this.ctx) {
            this.ctx.close();
        }
    }
}
