// @vitest-environment node
//
// The template helpers, called directly.
//
// Every one of them is already exercised through a mounted component
// (`tests/dates.test.js`, `fromnow`, `slugs`, `urls`, `batch`, `from-json`,
// `stripped`), and this file does not repeat that work. It goes after what a
// component cannot reach: the refusals, the branch a fixture would have to be
// built around, and the arguments Python spells `None`.
//
// It is also what makes them *visible*. They used to be strings of JavaScript in
// `injected.cjs`, so no coverage tool could instrument a line of them. Now they
// are a module, and this is the file that reads it.
//
// Node rather than jsdom on purpose: `striptags` has a branch that only exists
// where there is no DOM, and that branch is the whole server story.
import { test, expect, describe } from 'vitest';

import { NONE, __pybridge } from '../src/lib/runtime.js';
import {
    batch,
    date,
    from_json,
    fromnow,
    helpers,
    slugify,
    striptags,
    tojson,
    urlencode
} from '../src/lib/helpers.js';

describe('the set itself', () => {
    // The object the generated script binds. A helper added to the module and
    // forgotten here would be invisible to every component.
    test('every exported helper is in the object the compiler binds', () => {
        const exported = { batch, date, from_json, fromnow, slugify, striptags, tojson, urlencode };

        expect(Object.keys(helpers).sort()).toEqual(Object.keys(exported).sort());
        for (const [name, fn] of Object.entries(exported)) expect(helpers[name]).toBe(fn);
    });
});

describe('tojson', () => {
    test('a Python container goes out as plain JSON', () => {
        expect(tojson(__pybridge.list([1, 2]))).toBe('[1,2]');
    });

    test('a numeric indent is honoured', () => {
        expect(tojson(__pybridge.list([1])).length).toBeLessThan(tojson(__pybridge.list([1]), 2).length);
        expect(tojson(__pybridge.list([1]), 2)).toBe('[\n  1\n]');
    });

    // Python's None is an object, and `JSON.stringify(v, null, None)` would
    // quietly indent with it. Anything that is not a number is dropped.
    test('None as the indent means no indent, not indent-with-None', () => {
        expect(tojson(__pybridge.list([1]), NONE)).toBe('[1]');
        expect(tojson(__pybridge.list([1]), 'two')).toBe('[1]');
    });
});

describe('from_json', () => {
    test('parses into something Python can read', () => {
        const parsed = from_json('{"a": [1, 2]}');

        expect(__pybridge.str(parsed)).toBe("{'a': [1, 2]}");
    });

    test('bad JSON raises rather than returning nothing', () => {
        expect(() => from_json('{')).toThrow();
    });
});

describe('batch', () => {
    // Read back the way Python would read it. Comparing the objects directly
    // would compare Brython lists against JavaScript arrays, which look alike
    // and are not.
    const rows = (result) => __pybridge.str(result);

    test('groups into rows, the last one short', () => {
        expect(rows(batch(__pybridge.list([1, 2, 3, 4, 5]), 2))).toBe('[[1, 2], [3, 4], [5]]');
    });

    test('fill pads the last row, which is what aligns a table', () => {
        expect(rows(batch(__pybridge.list([1, 2, 3]), 2, 0))).toBe('[[1, 2], [3, 0]]');
    });

    // The rule the whole set follows: None means *no* padding. It is an object,
    // so `!== undefined` alone would let it through and render it as a cell.
    test('None as the fill means no padding at all', () => {
        expect(rows(batch(__pybridge.list([1, 2, 3]), 2, NONE))).toBe('[[1, 2], [3]]');
    });

    test.for([[0], [-1], [1.5], ['2'], [NONE]])('a size of %s is refused', ([size]) => {
        expect(() => batch(__pybridge.list([1]), size)).toThrow(
            /size must be an integer of at least one/
        );
    });

    test('an empty input gives no rows rather than one empty row', () => {
        expect(rows(batch(__pybridge.list([]), 3))).toBe('[]');
    });
});

describe('date', () => {
    // A fixed instant, so the assertions do not move with the clock. Noon UTC,
    // to keep the calendar day the same either side of the date line.
    const AT = '2026-09-10T12:00:00Z';

    test('reads the four shapes a component actually receives', () => {
        const expected = date(AT, 'medium', undefined, 'en-GB');

        expect(date(new Date(AT), 'medium', undefined, 'en-GB')).toBe(expected);
        expect(date(Date.parse(AT), 'medium', undefined, 'en-GB')).toBe(expected);
        expect(date('2026-09-10', 'medium', undefined, 'en-GB')).toBe(expected);
    });

    test('answers in the language it is given, which is the point of the locale', () => {
        expect(date(AT, 'long', undefined, 'fr-FR')).toMatch(/septembre/);
        expect(date(AT, 'long', undefined, 'en-GB')).toMatch(/September/);
    });

    test('with neither style it falls back to a medium date and no time', () => {
        expect(date(AT, undefined, undefined, 'en-GB')).toBe(date(AT, 'medium', undefined, 'en-GB'));
        expect(date(AT, NONE, NONE, 'en-GB')).toBe(date(AT, 'medium', undefined, 'en-GB'));
    });

    test('a time style alone gives a time alone', () => {
        const only = date(AT, undefined, 'short', 'en-GB');

        expect(only).toMatch(/\d/);
        expect(only).not.toMatch(/September|Sept/);
    });

    // Not a silent Invalid Date in the page: a value that is not a date is a
    // mistake, and the message names what it was given.
    test.for([['not a date'], [''], [NONE]])('%s is refused, and named', ([value]) => {
        expect(() => date(value)).toThrow(/date\(\): .* is not a date/);
    });

    // `JSON.stringify(undefined)` is `undefined`, not a string, so the message
    // would have read "date(): undefined is not a date" only by accident.
    test('and so is nothing at all', () => {
        expect(() => date(undefined)).toThrow(/date\(\): undefined is not a date/);
    });

    // Without a locale, `Intl` uses the platform's, which is the right default
    // and the wrong one under server rendering: see the note on the helper.
    test('with no locale it still formats, in the platform’s own', () => {
        expect(date(AT, 'medium')).toMatch(/\d/);
    });
});

describe('fromnow', () => {
    const at = (seconds) => new Date(Date.now() + seconds * 1000);

    // Every unit, both directions. The direction lives in the value, which is
    // why the name says neither "since" nor "until".
    test.for([
        [-90000000, /year/],
        [-3000000, /month/],
        [-700000, /week/],
        [-90000, /day/],
        [-4000, /hour/],
        [-90, /minute/],
        [-5, /second/]
    ])('a gap of %s seconds reads in its own unit', ([seconds, unit]) => {
        expect(fromnow(at(seconds), 'en-GB')).toMatch(unit);
    });

    // Three days rather than one: at a single unit `numeric: 'auto'` answers
    // "yesterday" and "tomorrow", which carry the direction in the word instead.
    test('the same gap forward and back differ only in direction', () => {
        expect(fromnow(at(-260000), 'en-GB')).toBe('3 days ago');
        expect(fromnow(at(260000), 'en-GB')).toBe('in 3 days');
    });

    test('and it speaks the language it is given', () => {
        expect(fromnow(at(-90000), 'fr-FR')).toMatch(/hier|jour/);
    });

    // `numeric: 'auto'` is what turns "1 day ago" into "yesterday", and it is
    // the reason a reader does not notice the helper at all.
    test('a single unit reads as a word rather than a number', () => {
        expect(fromnow(at(-86400), 'en-GB')).toBe('yesterday');
    });

    test.for([['not a date'], [NONE]])('%s is refused, and named', ([value]) => {
        expect(() => fromnow(value)).toThrow(/fromnow\(\): .* is not a date/);
    });

    test('with no locale it still formats, in the platform’s own', () => {
        expect(fromnow(at(-5))).toMatch(/\d|second|now/);
    });
});

describe('slugify', () => {
    test('a title becomes a URL segment', () => {
        expect(slugify('Making the GIL Optional!')).toBe('making-the-gil-optional');
    });

    test('accents are kept rather than folded away', () => {
        expect(slugify('Café Crème')).toBe('café-crème');
    });

    // The same character written two ways must give one slug, or two identical
    // titles produce two URLs.
    test('NFC first, so a composed and a decomposed é agree', () => {
        expect(slugify('café')).toBe(slugify('café'));
    });

    // A Devanagari vowel sign is a combining mark with no composed form, so
    // dropping marks would shred the word rather than fold it.
    test('marks are kept, which is what stops a script being shredded', () => {
        expect(slugify('हिन्दी भाषा')).toBe('हिन्दी-भाषा');
    });

    test('dashes are collapsed and trimmed at both ends', () => {
        expect(slugify('  --- a  //  b --- ')).toBe('a-b');
    });

    test('a non-string is read through Python first', () => {
        expect(slugify(42)).toBe('42');
    });
});

describe('striptags, off a browser', () => {
    // The whole server story in one branch: no fallback regex, because every
    // regex that ships with a template engine gets this wrong. A first render
    // shows less and then shows the text, rather than showing `caf&eacute;`.
    test('returns nothing rather than something wrong', () => {
        expect(typeof DOMParser).toBe('undefined');
        expect(striptags('<p>caf&eacute;</p>')).toBe('');
    });
});

describe('urlencode', () => {
    test('a string is escaped whole, the slash included', () => {
        expect(urlencode('a/b')).toBe('a%2Fb');
        expect(urlencode('café & co')).toBe('caf%C3%A9%20%26%20co');
    });

    test('a mapping becomes a query string', () => {
        expect(urlencode({ tag: 'a/b', page: 2 })).toBe('tag=a%2Fb&page=2');
    });

    // Jinja escapes the slash in a mapping and not in a string, because the two
    // forms reach different helpers. Escaping in both is the only reading that
    // holds, and this is what says so.
    test('and the two forms agree with each other, unlike Jinja', () => {
        expect(urlencode({ p: 'a/b' })).toBe('p=' + urlencode('a/b'));
    });

    // Read through Python instead, a Date gave
    // `%3CJavascript%20object%3A%20%5Bobject%20Date%5D%3E` in the query string.
    test('a Date is a value, and the sortable spelling of one', () => {
        expect(urlencode(new Date('2026-09-10T12:00:00Z'))).toBe('2026-09-10T12%3A00%3A00.000Z');
    });

    test('a number crosses as text', () => {
        expect(urlencode(42)).toBe('42');
    });

    // None is an object too, with `ob_type` and `__doc__` as own properties, so
    // it used to be walked as a mapping: `{urlencode(missing)}` wrote
    // `ob_type=%3Cclass+%27NoneType%27%3E&__doc__=` into the page.
    test('None is absence, not a mapping of its own internals', () => {
        expect(urlencode(NONE)).toBe('');
    });
});
