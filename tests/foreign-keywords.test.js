// A keyword call to a JavaScript function is undecidable: `foo(y=1, x=2)` on
// `function foo(x, y)` cannot be placed, because a JavaScript function carries
// no parameter names. Brython raises `TypeError: A Javascript function can't
// take keyword arguments` for exactly that reason.
//
// A call through `jsCall`'s proxy never reached that path. The keywords arrived
// as one extra **positional** argument, an object carrying `$kw`, and the
// function was handed it as if the author had written it: `measure(2, height=3)`
// called `measure(2, {$kw: …})`, so the second parameter was an object and the
// answer was `2x[object Object]` with nothing said.
//
// The decision was never ours and was never open — restoring Brython's own
// refusal is the whole repair. The injected helpers are the same question with
// the opposite answer, and for one reason: their parameter names are ours to
// know. See `tests/helper-keywords.test.js`.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ForeignKeywords from './fixtures/ForeignKeywords.svelte';

describe('a JavaScript function called from Python', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(ForeignKeywords, { target });
        flushSync();

        return (what) => String(instance.lire(what));
    };

    test('takes its arguments by position', () => {
        expect(setup()('positional')).toBe('2x3');
    });

    test.for([['keyword'], ['keyword only']])('refuses %s, naming why', ([what]) => {
        const read = setup()(what);

        expect(read).toContain('TypeError');
        expect(read).toContain("can't take keyword arguments");
    });

    // An empty `**` carries no name, so there is nothing to refuse — and Python
    // programs write one when a mapping happens to be empty.
    test('and an empty ** spread is not a keyword call', () => {
        expect(setup()('empty spread')).toBe('2x3');
    });
});
