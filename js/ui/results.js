/**
 * AeroBeat — Results Screen Module
 * Populates the results screen with scoring data, grade, and song info.
 * Two-column layout with grade glow effect.
 */

/**
 * Populate the results screen with scoring data.
 * @param {object} scoringState - State from createScoringState().
 * @param {object} beatmap - Beatmap with metadata.
 * @param {string} grade - Letter grade (S/A/B/C/D).
 */
export function showResults(scoringState, beatmap, grade) {
    setTextContent('result-perfect', scoringState.perfectCount.toString());
    setTextContent('result-good', scoringState.goodCount.toString());
    setTextContent('result-miss', scoringState.missCount.toString());
    setTextContent('result-combo', scoringState.maxCombo.toString());
    setTextContent('result-grade', grade);

    // Update song title on results
    if (beatmap) {
        const titleEl = document.querySelector('#screen-results .font-label-sm');
        if (titleEl) {
            titleEl.textContent = beatmap.metadata.title.toUpperCase();
        }
    }
}

/**
 * Safely set text content of an element by ID.
 * @param {string} id - Element ID.
 * @param {string} text - Text content.
 */
function setTextContent(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
