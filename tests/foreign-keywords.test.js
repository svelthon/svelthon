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

    // **Nothing to refuse is also nothing to pass on.** The carrier stayed in
    // the argument list, so the function was handed one argument more than the
    // author wrote: a variadic one counted two, and a parameter with a default
    // got an internal object instead of its default.
    //
    // `measure` could not see it — two parameters, and JavaScript drops a third
    // by itself — so the row above kept answering `2x3` while the call was
    // wrong. These two say what they were actually handed, which is the whole
    // reason they exist.
    test.for([
        ['a variadic function counts what it was given', 'counted', '1'],
        ['with an empty spread written out', 'counted with empty spread', '1'],
        ['and with an empty mapping behind a name', 'counted with an empty name', '1'],
        ['a default is kept', 'default kept', 'string'],
        ['and kept through an empty spread', 'default with empty spread', 'string']
    ])('%s', ([, what, answer]) => {
        expect(setup()(what)).toBe(answer);
    });
});
