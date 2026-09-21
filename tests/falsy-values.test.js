// `0`, `""`, `False` and `[]` are values an author writes on purpose, and they
// are the one input that tells `??` from `||`: `0 ?? x` is `0`, `0 || x` is `x`.
//
// The generated code and the injected helpers guard three places with `??` — a
// prop's value, a prop's default, and `get_context` — and a mutation sweep
// turned each of them into `||` without a single test going red. Nothing in the
// suite put a falsy value through any of the three, so a component given
// `count={0}` would have read `None` and nothing would have said so.
//
// The three are measured apart on purpose: a value **passed**, a value taken
// from a **default**, and a value out of a **context** reach the name by three
// different routes, and the reason this was one gap rather than three is that
// no test exercised any of them.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import FalsyHost from './fixtures/FalsyHost.svelte';

describe('a falsy value is a value', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(FalsyHost, { target });
        flushSync();

        return (where, key) =>
            target.querySelector(`[data-k="${where}"] [data-k="${key}"]`).textContent;
    };

    test.for([['passed'], ['defaulted']])('%s to a child', ([where]) => {
        const read = setup();

        // `0` and not nothing: `None` renders as the empty string, so the two
        // are told apart by what the page shows.
        expect(read(where, 'count')).toBe('0');
        expect(read(where, 'label')).toBe('[]');
        expect(read(where, 'flag')).toBe('False');
        expect(read(where, 'rows')).toBe('[]');
    });

    test('and out of a context', () => {
        const read = setup();

        expect(read('passed', 'context')).toBe('0');
        expect(read('passed', 'context-text')).toBe('[]');
    });

    // What the page cannot show: `0` and `None` are both short, an empty string
    // and an absent one are both nothing at all. The type settles it, and it is
    // Python answering about what Python holds.
    test.for([['passed'], ['defaulted']])('and it is still its own type, %s', ([where]) => {
        expect(setup()(where, 'kinds')).toBe('int|str|bool|list|int|str');
    });
});
