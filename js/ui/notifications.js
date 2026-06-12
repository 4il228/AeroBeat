/**
 * AeroBeat — Notifications Module
 * Toast notification system for error/status messages.
 * Replaces alert() and console.error() with styled UI toasts.
 */

/** Duration the toast remains visible (ms) */
const TOAST_DURATION = 3000;

/** Duration of fade-out animation (ms) */
const FADE_DURATION = 400;

/**
 * Show a toast notification at the top of the viewport.
 * Removes any existing toast before showing a new one.
 * @param {string} message - Text to display.
 * @param {boolean} [isError=true] - If true, styles toast as error.
 */
export function showToast(message, isError = true) {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${isError ? 'error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), FADE_DURATION);
    }, TOAST_DURATION);
}
