/**
 * AeroBeat — Menu Module
 * Main menu setup: bubble atmosphere, file input wiring, drag & drop.
 */

/** Number of floating bubbles in the background */
const BUBBLE_COUNT = 25;

/**
 * Create floating bokeh bubble atmosphere.
 * Generates bubbles with randomized size, position, and style variants.
 * Matches Frutiger Aero aesthetic with glass-like bokeh spheres.
 */
export function createBubbles() {
    const container = document.getElementById('bubbles-container');
    if (!container) return;

    for (let i = 0; i < BUBBLE_COUNT; i++) {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';

        const roll = Math.random();
        if (roll < 0.25) {
            bubble.classList.add('large');
        } else if (roll < 0.45) {
            bubble.classList.add('tinted');
        }

        const size = Math.random() < 0.2
            ? Math.random() * 140 + 80
            : Math.random() * 70 + 20;

        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${Math.random() * 100}vw`;
        bubble.style.animation = `float-up ${Math.random() * 14 + 10}s linear ${Math.random() * 12}s infinite`;

        container.appendChild(bubble);
    }
}

/**
 * Set up a hidden file input and wire the "Load & Play" button to trigger it.
 * @param {function(File): void} onFileSelected - Callback when a file is chosen.
 * @returns {HTMLInputElement} The hidden file input element.
 */
export function setupFileInput(onFileSelected) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    input.style.display = 'none';
    input.id = 'audio-file-input';
    document.body.appendChild(input);

    input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) onFileSelected(file);
        input.value = '';
    });

    const loadBtn = document.querySelector('#screen-main-menu .glossy-button');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => input.click());
    }

    return input;
}

/**
 * Set up drag & drop file loading on the game viewport.
 * Supports dragenter, dragover, dragleave, and drop events.
 * @param {function(File): void} onFileSelected - Callback when a file is dropped.
 */
export function setupDragDrop(onFileSelected) {
    const viewport = document.querySelector('.game-viewport');
    if (!viewport) return;

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => {
        viewport.addEventListener(evt, (e) => {
            e.preventDefault();
            e.stopPropagation();
        });
    });

    viewport.addEventListener('drop', (e) => {
        const files = e.dataTransfer?.files;
        if (files && files.length > 0) {
            onFileSelected(files[0]);
        }
    });
}
