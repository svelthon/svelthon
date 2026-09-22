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
import { test, expect, describe } from 'vitest';
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

        // The language and not the phrasing: a fixed date reads "10 hours ago"
        // on the day and "yesterday" the morning after, so asserting the words
        // is a test that moves with the clock — and this one did, overnight.
        expect(read('fromnow-english')).not.toBe(read('fromnow-french'));
        expect(read('fromnow-french')).toMatch(/hier|il y a|dans /);
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
        ['more positions than the signature has', 'too many', /takes at most 1 positional argument but 2/]
    ])('%s is refused', ([, what, says]) => {
        expect(setup()(what)).toMatch(says);
    });
});
