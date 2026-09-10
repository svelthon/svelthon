import { test, expect, describe, vi, afterEach } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import FromNow from './fixtures/FromNow.svelte';

// Django's `|timesince` and `|timeuntil` in one name, which is neither of
// theirs: `Intl` formats a signed gap, so "since" would lie half the time.
// `fromnow` is what the JavaScript world calls it.
//
// It is also the one helper Django could not have had: a rendered page is
// finished, so "3 minutes ago" is true once and then wrong. A component stays on
// screen, so this one wakes itself when the display would change — and asks for
// the delay the display needs, so it slows down as the date ages.
describe('fromnow', () => {
    const mounted = [];

    // The clock is shared by the whole document, and its timer is cleared when
    // the last reader goes away. Leaving components mounted from one test to the
    // next would leave a timer armed and block the next one from re-arming — so
    // this is not tidiness, it is what keeps the tests independent.
    afterEach(() => {
        // *Every* mount, not just the last: a test that sets up twice would
        // leave a timer armed and stop the next one from re-arming.
        while (mounted.length) unmount(mounted.pop(), { outro: false });
        vi.useRealTimers();
    });

    const setup = (props) => {
        const target = document.body.appendChild(document.createElement('div'));
        mounted.push(mount(FromNow, { target, props }));
        flushSync();

        return () => target.querySelector('p[data-k="said"]').textContent;
    };

    const ago = (seconds) => new Date(Date.now() - seconds * 1000).toISOString();

    test('the past, in the reader\'s language', () => {
        expect(setup({ when: ago(3 * 86400) })()).toBe('il y a 3 jours');
    });

    test('the future needs no second name, unlike Django', () => {
        // `|timesince` and `|timeuntil` both answer `0 minutes` for a date on
        // the wrong side; Intl formats a signed gap, so one name is enough.
        expect(setup({ when: new Date(Date.now() + 3 * 86400 * 1000).toISOString() })()).toBe('dans 3 jours');
    });

    test('another language, same date', () => {
        expect(setup({ when: ago(3 * 86400), locale: 'en-GB' })()).toBe('3 days ago');
    });

    // The three the name has to be true for: behind, on, and ahead of now.
    test('and the present, which is the third case', () => {
        expect(setup({ when: new Date().toISOString() })()).toBe('maintenant');
        expect(setup({ when: new Date().toISOString(), locale: 'en-GB' })()).toBe('now');
    });

    test('and the future', () => {
        expect(setup({ when: new Date(Date.now() + 7200 * 1000).toISOString() })()).toBe('dans 2 heures');
    });

    test('the unit follows the size of the gap', () => {
        expect(setup({ when: ago(30) })()).toBe('il y a 30 secondes');
    });

    // 100 minutes, not 90: `ago()` and the render read the clock separately, so
    // a gap built on an exact half — 90 minutes is 1.5 hours — is decided by
    // however many milliseconds pass between the two reads. That case has its
    // own test below, with the clock held still.
    test('a gap of hours', () => {
        expect(setup({ when: ago(100 * 60) })()).toBe('il y a 2 heures');
    });

    // The exact half, pinned rather than fixed. `Math.round` breaks ties
    // towards +Infinity — the platform's rule, which Intl and every JS date
    // library follow — so a signed gap of half a unit reads 2 ahead and 1
    // behind. Nothing on screen ever shows it: a real clock steps at the same
    // 1.5001 either way, and only a date built from `Date.now()` lands on the
    // half itself. Fake timers are what make that case reachable at all.
    test('an exact half follows the platform, and rounds towards the future', () => {
        vi.useFakeTimers();

        const ahead = new Date(Date.now() + 90 * 60 * 1000).toISOString();

        expect(setup({ when: ago(90 * 60), locale: 'en-GB' })()).toBe('1 hour ago');
        expect(setup({ when: ahead, locale: 'en-GB' })()).toBe('in 2 hours');
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
