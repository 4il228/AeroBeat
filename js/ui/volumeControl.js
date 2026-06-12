/**
 * AeroBeat — Volume Control UI
 * A Frutiger Aero-styled vertical volume slider.
 * Positioned to the right of the game viewport inside .game-layout.
 * Controls master volume for both menu music and gameplay audio.
 */

const STORAGE_KEY = 'aerobeat-master-volume';
const DEFAULT_VOLUME = 0.75;

/**
 * Create the volume control DOM and attach listeners.
 * @param {function(number): void} onVolumeChange - Callback with new volume 0–1.
 * @returns {{ setVolume: (v: number) => void, destroy: () => void }}
 */
export function createVolumeControl(onVolumeChange) {
    const saved = loadVolume();

    const wrapper = document.createElement('div');
    wrapper.className = 'volume-control-wrapper';
    wrapper.innerHTML = `
        <div class="volume-control aero-glass">
            <span class="material-symbols-outlined volume-icon">volume_up</span>
            <div class="volume-slider-wrap">
                <div class="volume-fill-track" style="height: ${saved * 100}%"></div>
                <input
                    type="range"
                    class="volume-slider"
                    min="0"
                    max="100"
                    value="${Math.round(saved * 100)}"
                    aria-label="Master Volume"
                />
            </div>
        </div>
    `;

    const host = document.querySelector('.game-layout');
    if (host) {
        host.appendChild(wrapper);
    } else {
        document.body.appendChild(wrapper);
    }

    const slider = wrapper.querySelector('.volume-slider');
    const icon = wrapper.querySelector('.volume-icon');
    const fillTrack = wrapper.querySelector('.volume-fill-track');

    /**
     * Update the speaker icon based on volume level.
     * @param {number} v - Volume 0–1.
     */
    function updateIcon(v) {
        if (v === 0) {
            icon.textContent = 'volume_off';
        } else if (v < 0.35) {
            icon.textContent = 'volume_mute';
        } else if (v < 0.7) {
            icon.textContent = 'volume_down';
        } else {
            icon.textContent = 'volume_up';
        }
    }

    /**
     * Update the fill bar height for vertical track.
     * @param {number} v - Volume 0–1.
     */
    function updateFill(v) {
        fillTrack.style.height = `${v * 100}%`;
    }

    updateIcon(saved);
    updateFill(saved);

    slider.addEventListener('input', () => {
        const v = slider.value / 100;
        updateIcon(v);
        updateFill(v);
        saveVolume(v);
        onVolumeChange(v);
    });

    return {
        setVolume(v) {
            v = Math.max(0, Math.min(1, v));
            slider.value = Math.round(v * 100);
            updateIcon(v);
            updateFill(v);
            saveVolume(v);
        },
        destroy() {
            wrapper.remove();
        }
    };
}

/**
 * Load saved volume from localStorage.
 * @returns {number} Volume 0–1.
 */
function loadVolume() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) {
            const v = parseFloat(raw);
            if (!isNaN(v) && v >= 0 && v <= 1) return v;
        }
    } catch (e) { /* localStorage unavailable */ }
    return DEFAULT_VOLUME;
}

/**
 * Persist volume to localStorage.
 * @param {number} v - Volume 0–1.
 */
function saveVolume(v) {
    try {
        localStorage.setItem(STORAGE_KEY, String(v));
    } catch (e) { /* localStorage unavailable */ }
}
