/**
 * AeroBeat — Application Entry Point
 * Initialization, game loop integration, keyboard input, hit feedback.
 * Delegates UI concerns to js/ui/ modules.
 */

import { AudioPlayer } from './audio/player.js';
import { MenuMusicPlayer } from './audio/menuMusic.js';
import { generateBeatmap } from './audio/analyzer.js';
import { initReceptors, getLaneX, getReceptorY, flashReceptor } from './game/receptor.js';
import { initNotes } from './game/note.js';
import { createConductor } from './game/conductor.js';
import { categorizeHit, isHitValid, INPUT_IGNORE_THRESHOLD } from './game/hitDetection.js';
import { createScoringState, processHit, calculateAccuracy, determineGrade, formatScore } from './game/scoring.js';

import { navigate, setOnLeaveGameplay } from './ui/screens.js';
import { createBubbles, setupFileInput, setupDragDrop, setupLibraryButton } from './ui/menu.js';
import { resetProgress, updateProgress as setLoadingProgress, setBpmLabel } from './ui/loading.js';
import { updateScore, updateCombo, updateProgress as setGameProgress, setSongTitle, resetHud } from './ui/hud.js';
import { showResults } from './ui/results.js';
import { showToast } from './ui/notifications.js';
import { createVolumeControl } from './ui/volumeControl.js';
import { initPublishForm, openPublishForm } from './ui/publishForm.js';
import { initLibrary, loadLibrary } from './ui/library.js';
import { Auth } from './auth/auth.js';
import { initProfile } from './ui/profile.js';

const LANE_KEYS = ['d', 'f', 'j', 'k'];

/** @type {AudioPlayer} */
const audioPlayer = new AudioPlayer();

/** @type {MenuMusicPlayer} */
const menuMusic = new MenuMusicPlayer();

/** @type {boolean} Whether menu music has been started by user interaction */
let menuMusicStarted = false;

/** @type {object|null} */
let currentBeatmap = null;

/** @type {File|null} Current locally-loaded audio file (null if track is from Library) */
let currentFile = null;

/** @type {object|null} */
let conductor = null;

/** @type {object|null} */
let scoringState = null;

/** @type {number|null} HUD update interval */
let hudInterval = null;

/** @type {boolean} Whether game is currently paused */
let isPaused = false;

/**
 * Handle file loading and transition to gameplay.
 * @param {File} file
 */
async function handleFileLoad(file) {
    navigate('screen-loading');
    menuMusic.fadeOut(1.5);
    resetProgress();
    currentFile = file;

    try {
        currentBeatmap = await generateBeatmap(file, (progress) => {
            setLoadingProgress(progress);
        });

        setBpmLabel(`${currentBeatmap.metadata.bpm} BPM DETECTED`);

        await audioPlayer.load(file);

        startGameplay();
    } catch (err) {
        navigate('screen-main-menu');
        showToast(err.message || 'Failed to load audio file');
    }
}

/**
 * Initialize and start the gameplay session.
 */
async function startGameplay() {
    navigate('screen-gameplay');

    if (currentBeatmap) {
        setSongTitle(currentBeatmap.metadata.title);
    }

    initReceptors(4);

    const notesContainer = document.getElementById('notes-container');
    if (!notesContainer) return;

    const lanePositions = [];
    for (let i = 0; i < 4; i++) {
        lanePositions.push(getLaneX(i, notesContainer));
    }
    initNotes(notesContainer, lanePositions, 60);

    scoringState = createScoringState();
    updateHud();

    conductor = createConductor({
        beatmap: currentBeatmap,
        audioPlayer,
        notesContainer,
        receptorsContainer: document.getElementById('receptors'),
        onMiss: handleMiss,
        onGameEnd: handleGameEnd,
    });

    // Freeze: notes drawn at ~100px above receptor for 3s, then music + falling start together
    showCountdown();
    conductor.startFreeze(3, () => {
        hideCountdown();
        audioPlayer.play();
        startHudInterval();
    });
}

/**
 * Handle a missed note.
 * @param {number} noteIndex
 * @param {object} note
 */
function handleMiss(noteIndex, note) {
    if (!scoringState) return;
    processHit(scoringState, 'miss');
    updateHud();
    showHitFeedback('miss', note.track);
}

/**
 * Handle game end — compute results and navigate.
 */
function handleGameEnd() {
    if (!scoringState || !currentBeatmap) return;

    clearHudInterval();
    conductor.stop();
    audioPlayer.stop();
    hidePauseOverlay();
    isPaused = false;

    const accuracy = calculateAccuracy(scoringState);
    const grade = determineGrade(accuracy);

    showResults(scoringState, currentBeatmap, grade);

    // Show publish button only for locally loaded files (not from Library)
    const publishBtn = document.getElementById('publish-results-btn');
    if (publishBtn) {
        if (currentFile) {
            publishBtn.classList.remove('hidden');
        } else {
            publishBtn.classList.add('hidden');
        }
    }

    setTimeout(() => {
        navigate('screen-results');
    }, 800);
}

/**
 * Toggle pause state during gameplay.
 */
function togglePause() {
    if (!conductor || !conductor.running) return;

    if (isPaused) {
        resumeGame();
    } else {
        pauseGame();
    }
}

/**
 * Pause the game — stops audio and conductor loop.
 */
function pauseGame() {
    if (isPaused) return;
    isPaused = true;
    audioPlayer.pause();
    conductor.stop();
    clearHudInterval();
    showPauseOverlay();
}

/**
 * Resume the game from paused state.
 */
async function resumeGame() {
    if (!isPaused) return;
    isPaused = false;
    hidePauseOverlay();

    await audioPlayer.play();
    conductor.start();
    startHudInterval();
}

/**
 * Show the pause overlay.
 */
function showPauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.remove('hidden');
}

/**
 * Hide the pause overlay.
 */
function hidePauseOverlay() {
    const overlay = document.getElementById('pause-overlay');
    if (overlay) overlay.classList.add('hidden');
}

/**
 * Show the countdown overlay and restart its CSS animations.
 */
function showCountdown() {
    const overlay = document.getElementById('countdown-overlay');
    if (!overlay) return;
    overlay.classList.remove('hidden');
    const els = overlay.querySelectorAll('.countdown-number');
    els.forEach(el => {
        el.style.animation = 'none';
        void el.offsetHeight;
        el.style.animation = '';
    });
}

/**
 * Hide the countdown overlay.
 */
function hideCountdown() {
    const overlay = document.getElementById('countdown-overlay');
    if (overlay) overlay.classList.add('hidden');
}

/**
 * Update HUD displays (score, combo, progress).
 */
function updateHud() {
    if (!scoringState) return;

    updateScore(scoringState.score);
    updateCombo(scoringState.combo);

    if (conductor) {
        setGameProgress(conductor.getProgress());
    }
}

/**
 * Start HUD update interval (10fps for smooth score display).
 */
function startHudInterval() {
    clearHudInterval();
    hudInterval = setInterval(updateHud, 100);
}

/**
 * Clear HUD update interval.
 */
function clearHudInterval() {
    if (hudInterval) {
        clearInterval(hudInterval);
        hudInterval = null;
    }
}

/**
 * Show floating hit feedback text at receptor position.
 * @param {'perfect'|'good'|'miss'} type
 * @param {number} lane
 */
function showHitFeedback(type, lane) {
    const receptorsContainer = document.getElementById('receptors');
    if (!receptorsContainer) return;

    const receptor = receptorsContainer.children[lane];
    if (!receptor) return;

    const rect = receptor.getBoundingClientRect();
    const gameViewport = document.querySelector('.game-viewport');
    if (!gameViewport) return;
    const vpRect = gameViewport.getBoundingClientRect();

    const text = document.createElement('div');
    text.className = `hit-text ${type}`;
    text.textContent = type === 'perfect' ? 'Perfect!' : type === 'good' ? 'Good' : 'Miss';

    text.style.left = `${rect.left - vpRect.left + rect.width / 2}px`;
    text.style.top = `${rect.top - vpRect.top - 30}px`;
    text.style.transform = 'translateX(-50%)';

    gameViewport.appendChild(text);

    setTimeout(() => text.remove(), 600);

    if (type === 'perfect') {
        spawnParticles(rect.left - vpRect.left + rect.width / 2, rect.top - vpRect.top, 'green', 8);
    } else if (type === 'good') {
        spawnParticles(rect.left - vpRect.left + rect.width / 2, rect.top - vpRect.top, 'blue', 4);
    }
}

/**
 * Spawn burst particles at a given position.
 * @param {number} x - Center X relative to viewport.
 * @param {number} y - Center Y relative to viewport.
 * @param {'green'|'blue'|'white'} color - Particle color class.
 * @param {number} count - Number of particles.
 */
function spawnParticles(x, y, color, count) {
    const gameViewport = document.querySelector('.game-viewport');
    if (!gameViewport) return;

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = `particle ${color}`;

        const size = Math.random() * 10 + 4;
        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${x}px`;
        p.style.top = `${y}px`;

        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const dist = Math.random() * 50 + 30;
        const px = Math.cos(angle) * dist;
        const py = Math.sin(angle) * dist - 20;
        p.style.setProperty('--px', `${px}px`);
        p.style.setProperty('--py', `${py}px`);
        p.style.setProperty('--particle-duration', `${0.3 + Math.random() * 0.3}s`);

        gameViewport.appendChild(p);
        setTimeout(() => p.remove(), 700);
    }
}

/**
 * Handle playing a track from the Library.
 * Fetches beatmap + audio from server, starts gameplay.
 * @param {number} trackId
 */
async function handleLibraryPlay(trackId) {
    navigate('screen-loading');
    menuMusic.fadeOut(1.5);
    resetProgress();
    currentFile = null; // Library tracks have no local file

    try {
        // Fetch track data including beatmap
        const res = await fetch(`http://localhost:3000/api/tracks/${trackId}`);
        if (!res.ok) throw new Error('Track not found');
        const trackData = await res.json();

        currentBeatmap = trackData.beatmap;
        if (!currentBeatmap) throw new Error('Beatmap data missing');

        setBpmLabel(`${currentBeatmap.metadata.bpm} BPM DETECTED`);
        setLoadingProgress(0.5);

        // Fetch audio file from server
        const audioUrl = `http://localhost:3000/${trackData.file_path}`;
        const audioRes = await fetch(audioUrl);
        if (!audioRes.ok) throw new Error('Failed to load audio file');
        const arrayBuffer = await audioRes.arrayBuffer();

        setLoadingProgress(0.8);

        await audioPlayer.loadFromBuffer(arrayBuffer);

        setLoadingProgress(1.0);
        startGameplay();
    } catch (err) {
        navigate('screen-main-menu');
        showToast(err.message || 'Failed to load track from library');
    }
}

/**
 * Handle keyboard input for gameplay.
 * @param {KeyboardEvent} e
 */
function handleKeyDown(e) {
    const key = e.key.toLowerCase();

    if (key === 'escape') {
        if (conductor && conductor.running) {
            togglePause();
        }
        return;
    }

    if (isPaused) return;

    const laneIndex = LANE_KEYS.indexOf(key);

    if (laneIndex === -1) return;
    if (!conductor || !conductor.running) return;

    e.preventDefault();

    const result = conductor.tryHit(laneIndex);

    if (!result.hit) return;
    if (!isHitValid(result.delta)) return;

    const hitType = categorizeHit(result.delta);
    conductor.markHit(result.noteIndex);

    if (scoringState) {
        processHit(scoringState, hitType);
        updateHud();
    }

    showHitFeedback(hitType, laneIndex);
}

/**
 * Set up keyboard event listeners.
 */
function setupKeyboard() {
    document.addEventListener('keydown', handleKeyDown);
}

/**
 * Wire up the stop button and pause overlay buttons.
 */
function setupButtons() {
    const stopBtn = document.querySelector('#screen-gameplay .glossy-button');
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            if (conductor && conductor.running) {
                handleGameEnd();
            }
        });
    }

    const pauseResumeBtn = document.getElementById('pause-resume');
    if (pauseResumeBtn) {
        pauseResumeBtn.addEventListener('click', () => {
            if (isPaused) resumeGame();
        });
    }

    const pauseQuitBtn = document.getElementById('pause-quit');
    if (pauseQuitBtn) {
        pauseQuitBtn.addEventListener('click', () => {
            handleGameEnd();
        });
    }
}

// Expose navigate globally for inline onclick handlers in HTML
// Wrap to handle menu music transitions
const _originalNavigate = navigate;
window.navigate = function(screenId) {
    _originalNavigate(screenId);
    if (screenId === 'screen-main-menu') {
        menuMusic.fadeIn(1.5);
    }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    createBubbles();
    setupFileInput(handleFileLoad);
    setupDragDrop(handleFileLoad);
    setupKeyboard();
    setupButtons();

    // Initialize publish form — on success navigate to library
    initPublishForm(() => {
        navigate('screen-library');
        loadLibrary();
    });

    // Initialize library — wire play callback
    initLibrary(handleLibraryPlay);

    // Wire Library button in main menu
    setupLibraryButton(window.navigate, async () => {
        await loadLibrary();
    });

    // Initialize auth
    const auth = new Auth();
    auth.init().then(() => {
        initProfile(auth);
    });

    // Wire bottom nav bar buttons
    const navItems = document.querySelectorAll('footer .flex.flex-col');
    if (navItems.length >= 4) {
        // Play button (index 0) — already works via global navigate
        // Library button (index 1) — wired in menu.js
        // Social button (index 2) — stub
        navItems[2].addEventListener('click', () => {
            showToast('Coming soon!');
        });
        // Profile button (index 3)
        navItems[3].addEventListener('click', () => {
            window.navigate('screen-profile');
        });
    }

    // Wire publish button on results screen
    const publishResultsBtn = document.getElementById('publish-results-btn');
    if (publishResultsBtn) {
        publishResultsBtn.addEventListener('click', () => {
            if (currentFile && currentBeatmap) {
                openPublishForm(currentFile, currentBeatmap);
            }
        });
    }

    // Volume control — reads saved volume from localStorage
    const savedVolume = (() => {
        try {
            const raw = localStorage.getItem('aerobeat-master-volume');
            if (raw !== null) {
                const v = parseFloat(raw);
                if (!isNaN(v) && v >= 0 && v <= 1) return v;
            }
        } catch (e) { /* ignore */ }
        return 0.75;
    })();

    audioPlayer.volume = savedVolume;
    menuMusic.volume = savedVolume;

    createVolumeControl((v) => {
        audioPlayer.volume = v;
        menuMusic.volume = v;
    });

    // Load menu music and auto-play on first user interaction
    menuMusic.load('assets/audio/main-theme.mp3').catch(err => {
        console.warn('Menu music failed to load:', err);
    });

    const startMenuMusic = async () => {
        if (menuMusicStarted) return;
        menuMusicStarted = true;
        document.removeEventListener('click', startMenuMusic);
        await menuMusic.play();
        menuMusic.fadeIn(2.0);
    };
    document.addEventListener('click', startMenuMusic);

    // Stop conductor when leaving gameplay screen
    setOnLeaveGameplay(() => {
        if (conductor) {
            conductor.stop();
            audioPlayer.stop();
            clearHudInterval();
            hidePauseOverlay();
            isPaused = false;
        }
    });
});
