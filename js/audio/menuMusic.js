/**
 * AeroBeat — Menu Background Music
 * Web Audio API player for looping menu music with smooth fade in/out.
 * Uses GainNode for volume ramping, AudioBufferSourceNode with loop=true.
 * AudioContext is created only on first user interaction (autoplay policy).
 */

/** @type {number} Default volume when fully faded in */
const DEFAULT_VOLUME = 0.35;

/** @type {number} Default fade duration in seconds */
const DEFAULT_FADE_DURATION = 1.5;

export class MenuMusicPlayer {
    constructor() {
        /** @type {AudioContext|null} */
        this.ctx = null;
        /** @type {AudioBufferSourceNode|null} */
        this.source = null;
        /** @type {GainNode|null} Master volume gain */
        this.masterGain = null;
        /** @type {GainNode|null} Fade gain */
        this.fadeGain = null;
        /** @type {AudioBuffer|null} */
        this.buffer = null;
        /** @type {boolean} */
        this.playing = false;
        /** @type {boolean} */
        this.initialized = false;
        /** @type {number} Current target volume */
        this.targetVolume = DEFAULT_VOLUME;
        /** @type {Promise<void>|null} */
        this._loadPromise = null;
        /** @type {number} Master volume level 0–1 */
        this._masterVolume = 1;
    }

    /**
     * Initialize AudioContext (must be called after user gesture).
     */
    init() {
        if (this.initialized) return;
        this.ctx = new AudioContext();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this._masterVolume;
        this.fadeGain = this.ctx.createGain();
        this.fadeGain.gain.value = 0;
        this.masterGain.connect(this.fadeGain);
        this.fadeGain.connect(this.ctx.destination);
        this.initialized = true;
    }

    /**
     * Load the menu music from a URL.
     * @param {string} url - Path to the audio file.
     * @returns {Promise<void>}
     */
    async load(url) {
        if (this._loadPromise) return this._loadPromise;

        this._loadPromise = (async () => {
            this.init();

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to fetch menu music: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
        })();

        return this._loadPromise;
    }

    /**
     * Start playing the menu music in a loop.
     * Resumes AudioContext if suspended (requires user gesture).
     * If already playing, does nothing.
     * @returns {Promise<void>}
     */
    async play() {
        if (!this.buffer || !this.initialized || this.playing) return;

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        this._createSource();
        this.source.start(0);
        this.playing = true;
    }

    /**
     * Create and connect a new AudioBufferSourceNode.
     * @private
     */
    _createSource() {
        this.source = this.ctx.createBufferSource();
        this.source.buffer = this.buffer;
        this.source.loop = true;
        this.source.connect(this.masterGain);
    }

    /**
     * Fade in the menu music.
     * @param {number} [duration=DEFAULT_FADE_DURATION] - Fade duration in seconds.
     * @param {number} [targetVolume=DEFAULT_VOLUME] - Target volume (0-1).
     */
    async fadeIn(duration = DEFAULT_FADE_DURATION, targetVolume = DEFAULT_VOLUME) {
        if (!this.initialized || !this.buffer) return;

        this.targetVolume = targetVolume;

        if (!this.playing) {
            await this.play();
        }

        if (this.ctx.state === 'suspended') {
            await this.ctx.resume();
        }

        const now = this.ctx.currentTime;
        this.fadeGain.gain.cancelScheduledValues(now);
        this.fadeGain.gain.setValueAtTime(this.fadeGain.gain.value, now);
        this.fadeGain.gain.linearRampToValueAtTime(targetVolume, now + duration);
    }

    /**
     * Fade out the menu music to silence.
     * Source keeps looping silently — fadeIn will ramp gain back seamlessly.
     * @param {number} [duration=DEFAULT_FADE_DURATION] - Fade duration in seconds.
     */
    fadeOut(duration = DEFAULT_FADE_DURATION) {
        if (!this.initialized || !this.playing) return;

        const now = this.ctx.currentTime;
        this.fadeGain.gain.cancelScheduledValues(now);
        this.fadeGain.gain.setValueAtTime(this.fadeGain.gain.value, now);
        this.fadeGain.gain.linearRampToValueAtTime(0, now + duration);
    }

    /**
     * Immediately stop and silence the music.
     */
    stop() {
        if (this.source && this.playing) {
            this.fadeGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.fadeGain.gain.value = 0;
            try { this.source.stop(); } catch (e) { /* already stopped */ }
            this.playing = false;
        }
    }

    /**
     * Get current effective volume level.
     * @type {number}
     */
    get volume() {
        return this.fadeGain ? this.fadeGain.gain.value : 0;
    }

    /**
     * Set master volume (0–1). Multiplies with fade gain.
     * @param {number} v
     */
    set volume(v) {
        this._masterVolume = Math.max(0, Math.min(1, v));
        if (this.masterGain) {
            this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
            this.masterGain.gain.setValueAtTime(this._masterVolume, this.ctx.currentTime);
        }
    }

    /**
     * Get master volume level.
     * @type {number}
     */
    get masterVolume() {
        return this._masterVolume;
    }

    /**
     * Destroy player and release all resources.
     */
    destroy() {
        this.stop();
        if (this.ctx) {
            this.ctx.close();
            this.ctx = null;
        }
        this.initialized = false;
        this.buffer = null;
    }
}
