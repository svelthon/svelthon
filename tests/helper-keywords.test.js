// The injected helpers are called by name as well as by position, because the
// README writes their signatures the way Python writes them —
// `tojson(value, indent=None)` — and an author writes what the documentation
// shows.
//
// Nothing read the keywords. They do arrive: Brython hands a keyword call a
// trailing object carrying `$kw`, an array whose first entry holds the literal
// keywords and whose rest are the dicts a `**` spread contributed. Dropping it
// was the worst of the three behaviours this project names — `tojson(rows,
// indent=2)` wrote unindented JSON and said nothing, and `batch(rows, n=2)`
// refused the author for a size they had just given.
//
// Measured through a mounted component rather than by handing the adapter a
// `$kw` object: the shape is Brython's, and a test that builds it itself would
// go on passing the day Brython changes it.
import { test, expect, describe, vi } from 'vitest';
import { mount, flushSync } from './mounted.js';
import HelperKeywords from './fixtures/HelperKeywords.svelte';

describe('an injected helper takes its arguments by name', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(HelperKeywords, { target });
        flushSync();

        return (what) => String(instance.lire(what));
    };

    test('a keyword lands where the same value lands positionally', () => {
        const read = setup();

        expect(read('json-keyword')).toBe(read('json-positional'));
        expect(read('batch-keyword')).toBe(read('batch-positional'));
    });

    // The witness the comparison above cannot give: that both are the *right*
    // answer rather than the same wrong one.
    test('and the value is honoured, not merely equal on both routes', () => {
        const read = setup();

        expect(read('json-keyword')).toContain('\n');
        expect(read('batch-keyword')).toBe('[[1, 2], [3, 4]]');
        expect(read('batch-fill')).toBe('[[1, 2, 3], [4, 0, 0]]');
    });

    // A keyword after another, and a keyword nobody would reach positionally:
    // `locale` is the fourth parameter of `date`.
    test('a later parameter is reachable by name alone', () => {
        const read = setup();

        expect(read('date-keyword')).toBe('20 Sept 2026');
    });

    // `fromnow` reads the clock, so the clock is fixed: three days after the
    // date, each language has one phrasing.
    test('and the locale reaches a helper that reads the clock', () => {
        vi.useFakeTimers({ now: new Date('2026-09-23T12:00:00Z'), toFake: ['Date'] });

        try {
            const read = setup();

            expect(read('fromnow-english')).toBe('3 days ago');
            expect(read('fromnow-french')).toBe('il y a 3 jours');
        } finally {
            vi.useRealTimers();
        }
    });

    // A dict is data even when one of its keys is `$kw`: the keyword bundle a
    // call carries is not a Python object.
    test('a dict with a $kw key is an argument, not keywords', () => {
        expect(setup()('kw data')).toBe('{"$kw":["ordinary","data"]}');
    });

    // The other half of what `$kw` carries.
    test('a ** spread carries its names too', () => {
        const read = setup();

        expect(read('json-spread')).toBe(read('json-positional'));
    });

    // A name the helper does not take is the one thing the author can have got
    // wrong, so it is said rather than ignored.
    test('a name no helper takes is refused, and the refusal lists the names', () => {
        const read = setup();

        expect(read('unknown')).toContain('no argument named espace');
        expect(read('unknown')).toContain('value, indent');
    });

    // **A fixed signature does not become permissive because a JavaScript
    // function implements it.** Each call below is a `TypeError` in CPython —
    // checked against `python3` on the same four spellings — and each was
    // silent: the keyword overwrote what position had put there, the spread
    // overwrote the keyword, and the extra word went to a function with nowhere
    // to put it. `batch(rows, 2, n=3)` is the one that costs data: it grouped
    // by three out of a call that asked for two.
    test.for([
        ['a parameter given by position and by name', 'by both', /multiple values for argument 'indent'/],
        ['a size given twice', 'size by both', /multiple values for argument 'n'/],
        ['a keyword the spread repeats', 'twice by spread', /multiple values for argument 'indent'/],
        // CPython says how many a signature takes when every parameter is
        // required, and says the *range* when one carries a default. Both
        // wordings, checked against `python3` on the same two shapes.
        ['more positions than the signature has', 'too many', /takes 1 positional argument but 2 were given/],
        ['more than a signature that has an optional', 'too many of two', /takes from 1 to 2 positional arguments but 3 were given/]
    ])('%s is refused', ([, what, says]) => {
        expect(setup()(what)).toMatch(says);
    });

    // **A parameter the signature requires and the call does not give.** The
    // table named the parameters and not which of them a call has to fill, so
    // an omission reached the helper as `undefined` and was read there as
    // absence: `slugify()` answered the empty string and `tojson(indent=2)`
    // wrote `null`, both without a word. A call whose only fault is a missing
    // argument is a call the author wants to be told about.
    //
    // CPython's wording again, and its way of listing the names: `'a'`, then
    // `'a' and 'b'`. Checked against `python3`.
    test.for([
        ['the only argument', 'nothing at all', /slugify\(\) missing 1 required positional argument: 'text'/],
        ['the required one, the optional given', 'only the optional', /tojson\(\) missing 1 required positional argument: 'value'/],
        ['the second of two', 'one of two', /batch\(\) missing 1 required positional argument: 'n'/],
        ['both of two', 'neither of two', /batch\(\) missing 2 required positional arguments: 'xs' and 'n'/]
    ])('%s is refused', ([, what, says]) => {
        expect(setup()(what)).toMatch(says);
    });

    // The witnesses without which the rows above would be satisfied by a check
    // that reads the *value*: absence is a position nobody filled, and `None`,
    // `False`, `0` and the empty string are arguments that were given. Two of
    // them are what an author writes on purpose.
    test.for([
        ['None', 'explicit none', 'null'],
        ['False', 'explicit false', 'false'],
        ['zero', 'explicit zero', '0'],
        ['the empty string', 'empty text', ''],
        ['and an optional simply left out', 'optional left out', '[1,2,3,4]']
    ])('%s is an argument, not an omission', ([, what, answer]) => {
        expect(setup()(what)).toBe(answer);
    });
});
