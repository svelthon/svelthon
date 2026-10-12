import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Dates from './fixtures/Dates.svelte';
import ReactiveDateHost from './fixtures/ReactiveDateHost.svelte';
import { date, fromnow, urlencode } from '../src/lib/helpers.js';

// A `SvelteDate` changed in place by its parent: the helpers read its instant
// through its own `getTime`, which is what subscribes the page, where reading
// the slot alone kept the old text.
test('the date helpers follow a SvelteDate changed in place', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(ReactiveDateHost, { target });
    flushSync();

    const read = () => ['date', 'urlencode', 'fromnow'].map((k) => target.querySelector(`p[data-k="${k}"]`).textContent);
    const before = read();

    host.change();
    flushSync();

    const after = read();
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(before[2]).toBe('in 2 weeks');
    expect(after[2]).toBe('2 weeks ago');
});

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

// A Date built by another JavaScript context — an iframe, a worker, a `vm`, an
// adapter — is a Date by every behaviour, and `instanceof Date` answers false
// because it asks about *our* constructor. The three sites of `helpers.js` asked
// it: `date` and `fromnow` refused a perfectly good value, so a component
// holding one did not mount, and `urlencode` said nothing and wrote the Python
// spelling of the object into the query string.
//
// The same realm mistake the route boundary made with `URL` the day before, and
// the sweep that should have followed it did not happen. What replaces it is the
// brand itself: `getTime` called against the value reads an internal slot, which
// is per-object and not per-realm.
describe('a Date from another JavaScript context', () => {
    const foreign = (ms) => {
        const frame = document.body.appendChild(document.createElement('iframe'));

        return new frame.contentWindow.Date(ms);
    };

    test('is not ours by identity, which is the whole of the problem', () => {
        expect(foreign(0) instanceof Date).toBe(false);
    });

    test.for([
        ['date', (value) => date(value)],
        ['fromnow', (value) => fromnow(value)],
        ['urlencode', (value) => urlencode(value)]
    ])('%s answers for it what it answers for ours', ([, run]) => {
        expect(run(foreign(0))).toBe(run(new Date(0)));
    });

    test('and the refusals it already made still stand', () => {
        // The brand is a brand: an object that merely claims the tag is not one.
        const mimic = { getTime: () => 0, [Symbol.toStringTag]: 'Date' };

        expect(() => date(mimic)).toThrow(/is not a date/);
        expect(() => date(true)).toThrow(/is not a date/);
        expect(() => date([2026])).toThrow(/is not a date/);
    });
});
