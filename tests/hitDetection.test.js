import { describe, it, expect } from 'vitest';
import { categorizeHit, isHitValid, PERFECT_WINDOW, GOOD_WINDOW, INPUT_IGNORE_THRESHOLD } from '../js/game/hitDetection.js';

describe('hitDetection', () => {
    describe('categorizeHit', () => {
        it('returns perfect for delta within PERFECT_WINDOW', () => {
            expect(categorizeHit(0)).toBe('perfect');
            expect(categorizeHit(0.01)).toBe('perfect');
            expect(categorizeHit(PERFECT_WINDOW)).toBe('perfect');
        });

        it('returns good for delta within GOOD_WINDOW', () => {
            expect(categorizeHit(PERFECT_WINDOW + 0.001)).toBe('good');
            expect(categorizeHit(0.05)).toBe('perfect');
            expect(categorizeHit(GOOD_WINDOW)).toBe('good');
        });

        it('returns miss for delta beyond GOOD_WINDOW', () => {
            expect(categorizeHit(GOOD_WINDOW + 0.001)).toBe('miss');
            expect(categorizeHit(0.2)).toBe('miss');
            expect(categorizeHit(1.0)).toBe('miss');
        });

        it('handles edge cases', () => {
            expect(categorizeHit(0)).toBe('perfect');
            expect(categorizeHit(-0.01)).toBe('perfect'); // negative delta = early hit
        });
    });

    describe('isHitValid', () => {
        it('returns true for delta within threshold', () => {
            expect(isHitValid(0)).toBe(true);
            expect(isHitValid(0.1)).toBe(true);
            expect(isHitValid(INPUT_IGNORE_THRESHOLD - 0.001)).toBe(true);
        });

        it('returns false for delta beyond threshold', () => {
            expect(isHitValid(INPUT_IGNORE_THRESHOLD)).toBe(false);
            expect(isHitValid(1.0)).toBe(false);
        });
    });
});
