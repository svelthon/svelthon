import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Dates from './fixtures/Dates.svelte';
import { date, fromnow, urlencode } from '../src/lib/helpers.js';

// Django's `|date` keeps its word; what stands behind it is the platform's
// `Intl`, which answers in the reader's language — something Django's format
// letters never did.
describe('date', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Dates, { target });
        flushSync();
        return (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    test('an ISO string, with no style given', () => {
        expect(setup()('plain')).toBe('24 août 2026');
    });

    test('the four styles are Intl\'s, not Django\'s letters', () => {
        const read = setup();
        expect(read('long')).toBe('24 août 2026');
        expect(read('full')).toBe('lundi 24 août 2026');
    });

    test('a time style beside the date', () => {
        expect(setup()('time')).toBe('24/08/2026, 10:30');
    });

    test('a date alone, and a timestamp', () => {
        const read = setup();
        expect(read('day')).toBe('24/08/2026');
        expect(read('stamp')).toContain('2026');
    });

    test('the locale is what changes the reading', () => {
        expect(setup()('other')).toBe('August 24, 2026');
    });

    test('a value that is not a date says so, and says which', () => {
        expect(setup()('broken')).toContain('"pas une date" is not a date');
    });
});
