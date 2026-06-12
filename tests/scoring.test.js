import { describe, it, expect } from 'vitest';
import {
    createScoringState,
    processHit,
    calculateAccuracy,
    determineGrade,
    formatScore,
} from '../js/game/scoring.js';

describe('scoring', () => {
    describe('createScoringState', () => {
        it('returns initial state with all zeros', () => {
            const state = createScoringState();
            expect(state.score).toBe(0);
            expect(state.combo).toBe(0);
            expect(state.maxCombo).toBe(0);
            expect(state.multiplier).toBe(1);
            expect(state.perfectCount).toBe(0);
            expect(state.goodCount).toBe(0);
            expect(state.missCount).toBe(0);
            expect(state.totalNotes).toBe(0);
        });
    });

    describe('processHit', () => {
        it('adds 300 points for perfect hit', () => {
            const state = createScoringState();
            const result = processHit(state, 'perfect');

            expect(state.score).toBe(300);
            expect(state.combo).toBe(1);
            expect(state.maxCombo).toBe(1);
            expect(state.multiplier).toBe(1);
            expect(result.addedScore).toBe(300);
        });

        it('adds 100 points for good hit', () => {
            const state = createScoringState();
            const result = processHit(state, 'good');

            expect(state.score).toBe(100);
            expect(state.combo).toBe(1);
            expect(result.addedScore).toBe(100);
        });

        it('adds 0 points and resets combo for miss', () => {
            const state = createScoringState();
            processHit(state, 'perfect');
            processHit(state, 'perfect');
            const result = processHit(state, 'miss');

            expect(state.score).toBe(600);
            expect(state.combo).toBe(0);
            expect(state.multiplier).toBe(1);
            expect(result.addedScore).toBe(0);
        });

        it('increases multiplier every 50 combo', () => {
            const state = createScoringState();

            // Build combo to 50
            for (let i = 0; i < 50; i++) {
                processHit(state, 'perfect');
            }
            expect(state.multiplier).toBe(2); // 1 + floor(50/50) = 2

            // 51st hit
            const result = processHit(state, 'perfect');
            expect(state.multiplier).toBe(2);
            expect(result.addedScore).toBe(600); // 300 * 2
        });

        it('tracks max combo across misses', () => {
            const state = createScoringState();
            for (let i = 0; i < 10; i++) processHit(state, 'perfect');
            processHit(state, 'miss');
            for (let i = 0; i < 5; i++) processHit(state, 'perfect');

            expect(state.maxCombo).toBe(10);
            expect(state.combo).toBe(5);
        });

        it('increments totalNotes for every hit type', () => {
            const state = createScoringState();
            processHit(state, 'perfect');
            processHit(state, 'good');
            processHit(state, 'miss');

            expect(state.totalNotes).toBe(3);
            expect(state.perfectCount).toBe(1);
            expect(state.goodCount).toBe(1);
            expect(state.missCount).toBe(1);
        });
    });

    describe('calculateAccuracy', () => {
        it('returns 0 for no notes', () => {
            const state = createScoringState();
            expect(calculateAccuracy(state)).toBe(0);
        });

        it('returns 100 for all perfect', () => {
            const state = createScoringState();
            for (let i = 0; i < 10; i++) processHit(state, 'perfect');
            expect(calculateAccuracy(state)).toBe(100);
        });

        it('calculates mixed accuracy', () => {
            const state = createScoringState();
            for (let i = 0; i < 8; i++) processHit(state, 'perfect');
            for (let i = 0; i < 2; i++) processHit(state, 'miss');
            expect(calculateAccuracy(state)).toBe(80);
        });
    });

    describe('determineGrade', () => {
        it('returns S for >= 95%', () => {
            expect(determineGrade(95)).toBe('S');
            expect(determineGrade(100)).toBe('S');
        });

        it('returns A for >= 85%', () => {
            expect(determineGrade(85)).toBe('A');
            expect(determineGrade(94.9)).toBe('A');
        });

        it('returns B for >= 70%', () => {
            expect(determineGrade(70)).toBe('B');
            expect(determineGrade(84.9)).toBe('B');
        });

        it('returns C for >= 50%', () => {
            expect(determineGrade(50)).toBe('C');
            expect(determineGrade(69.9)).toBe('C');
        });

        it('returns D for < 50%', () => {
            expect(determineGrade(0)).toBe('D');
            expect(determineGrade(49.9)).toBe('D');
        });
    });

    describe('formatScore', () => {
        it('pads with leading zeros', () => {
            expect(formatScore(0)).toBe('00000');
            expect(formatScore(1)).toBe('00001');
            expect(formatScore(123)).toBe('00123');
            expect(formatScore(12345)).toBe('12345');
        });
    });
});
