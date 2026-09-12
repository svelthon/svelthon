import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Signatures from './fixtures/Signatures.svelte';

// A DOM handler is called with one argument and a Python `def` may want none,
// so the call is trimmed to what the signature declares. The arity comes from
// Brython's `$function_infos`, position 10 for the count and position 8 for the
// name of a `*args`, which is the engine's *layout* rather than its API: it can
// move in a release with nothing to announce it.
//
// Measured on 2026-09-13: the fixtures bind 74 handlers and between them they
// have two shapes, `def f()` 72 times and `def f(e)` twice. The reader itself
// was covered, by the exported-function and `$inspect` paths which share it;
// what nothing reached was those shapes *as a DOM handler*, which is the path
// with the trimming.
describe('a handler receives what its signature declares', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Signatures, { target });
        flushSync();

        return {
            read: () => target.querySelector('[data-k="seen"]').textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test.for([
        // No parameters: handing it the event would be a TypeError, and this is
        // the shape 72 of the 74 use.
        ['def f()', 'bare', 'bare/0'],
        ['def f(event)', 'plain', 'plain/DOMEvent'],
        // A default is not a parameter the DOM fills: one argument is offered,
        // so `extra` keeps its default.
        ['def f(event, extra=None)', 'defaulted', 'defaulted/DOMEvent/None'],
        // `*args` takes everything there is, which is the position 8 branch and
        // the one nothing reached.
        ['def f(*rest)', 'starred', 'starred/1/DOMEvent'],
        // Keyword-only after a star: one positional, and the keyword keeps its
        // default.
        ['def f(event, *, tag="t")', 'keyword_only', 'keyword_only/DOMEvent/t']
    ])('%s', ([, button, expected]) => {
        const { read, click } = setup();

        click(button);
        expect(read()).toBe(expected);
    });
});
