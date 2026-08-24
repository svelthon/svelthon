import { test, expect, describe, vi, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import Since from './fixtures/Since.svelte';

// Django's `|timesince`, and the one helper Django could not have had: a
// rendered page is finished, so "3 minutes ago" is true once and then wrong. A
// component stays on screen, so this one wakes itself when the display would
// change — and asks for the delay the display needs, so it slows down as the
// date ages instead of beating at a fixed rate.
describe('timesince', () => {
    let mounted = null;

    // The clock is shared by the whole document, and its timer is cleared when
    // the last reader goes away. Leaving components mounted from one test to the
    // next would leave a timer armed and block the next one from re-arming — so
    // this is not tidiness, it is what keeps the tests independent.
    afterEach(() => {
        if (mounted) unmount(mounted, { outro: false });
        mounted = null;
        vi.useRealTimers();
    });

    const setup = (props) => {
        const target = document.body.appendChild(document.createElement('div'));
        mounted = mount(Since, { target, props });
        flushSync();

        return () => target.querySelector('p[data-k="said"]').textContent;
    };

    const ago = (seconds) => new Date(Date.now() - seconds * 1000).toISOString();

    test('the past, in the reader\'s language', () => {
        expect(setup({ when: ago(3 * 86400) })()).toBe('il y a 3 jours');
    });

    test('another language, same date', () => {
        expect(setup({ when: ago(3 * 86400), locale: 'en-GB' })()).toBe('3 days ago');
    });

    test('and the future', () => {
        expect(setup({ when: new Date(Date.now() + 7200 * 1000).toISOString() })()).toBe('dans 2 heures');
    });

    test('the unit follows the size of the gap', () => {
        expect(setup({ when: ago(30) })()).toBe('il y a 30 secondes');
    });

    test('a gap of hours', () => {
        expect(setup({ when: ago(90 * 60) })()).toBe('il y a 2 heures');
    });

    test('a gap of years', () => {
        expect(setup({ when: ago(400 * 86400) })()).toBe('l’année dernière');
    });

    // The point of the whole thing: nobody touches the page, and it stays true.
    test('it updates itself as time passes', () => {
        vi.useFakeTimers();

        const read = setup({ when: ago(58) });
        expect(read()).toBe('il y a 58 secondes');

        vi.advanceTimersByTime(4000);
        flushSync();
        expect(read()).toBe('il y a 1 minute');

        vi.advanceTimersByTime(120 * 1000);
        flushSync();
        expect(read()).toBe('il y a 3 minutes');
    });

    // A date shown in days does not need waking every second.
    test('the delay follows the unit, so it slows down on its own', () => {
        vi.useFakeTimers();

        const read = setup({ when: ago(3 * 86400) });
        expect(read()).toBe('il y a 3 jours');

        vi.advanceTimersByTime(60 * 1000);
        flushSync();
        expect(read()).toBe('il y a 3 jours');
    });

    test('a value that is not a date says so', () => {
        expect(() => setup({ when: 'hier' })()).toThrow(/"hier" is not a date/);
    });
});
