// A DOM handler written in Python's template is called as Svelte calls one: a
// JavaScript function gets the element as its receiver by whichever road it was
// imported, Svelte warns about a handler that is no function where it warns in
// a component of its own, and a Python handler that raises reports an ordinary
// `Error`, written by name or in a spread.
import { test, expect, vi } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DomHandlers from './fixtures/DomHandlers.svelte';
import DomHandlersNative from './fixtures/DomHandlersNative.svelte';
import { seen } from './fixtures/dom_handlers.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';

const mounted = (component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(component, { target });
    flushSync();

    return (key) => target.querySelector(`[data-k="${key}"]`);
};

test.for([['named'], ['namespace']])('a JavaScript handler imported %s is called with the element', ([key]) => {
    const receivers = [DomHandlersNative, DomHandlers].map((component) => {
        seen.length = 0;
        mounted(component)(key).querySelector('span').click();
        return [...seen];
    });

    expect(receivers).toEqual([[true], [true]]);
});

// Svelte warns about an absent handler only after a call, `save()` written for
// `save`; a name holding None is an optional handler.
test('a handler that is no function is warned about as Svelte warns', () => {
    const warnings = [DomHandlersNative, DomHandlers].map((component) => {
        const at = mounted(component);

        return ['optional', 'called'].map((key) => {
            const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

            try {
                at(key).click();
                return warn.mock.calls.filter((args) => String(args[0]).includes('event_handler_invalid')).length;
            } finally {
                warn.mockRestore();
            }
        });
    });

    expect(warnings).toEqual([[0, 1], [0, 1]]);
});

// Which handler is written as a call, against Svelte's own reading of the same
// form in JavaScript (`has_side_effects`, on the expression's root): a call, a
// `new` and an assignment are; a name, a member, a subscript, a function, a
// conditional, a logical and a unary expression are not.
test.for([
    ['handler', false],
    ['obj.handler', false],
    ['handlers[key]', false],
    ['lambda event: save(event)', false],
    ['a if ready else make()', false],
    ['make() or other', false],
    ['not make()', false],
    ['save()', true],
    ['make(1)(2)', true],
    ['(save())', true],
    ['rows["x"].pop()', true],
    ['"-".join(parts)', true],
    ['(flag := not flag)', true]
])('`%s` is written as a call: %s', ([expression, called]) => {
    const written = pythonExpressions(`<button onclick={${expression}}>x</button>`, collector([]));

    expect(written.includes('?? undefined')).toBe(!called);
});

// What Svelte keeps for a delegated event, called as it calls it: what is
// thrown out of it is what the page's `error` event reports.
const delegated = (node) => node[Object.getOwnPropertySymbols(node).find((one) => one.description === 'events')].click;

test.for([['by name', 'fail'], ['in a spread', 'fail-spread']])('a Python handler written %s raises an ordinary Error', ([, key]) => {
    const node = mounted(DomHandlers)(key);
    let thrown;

    try {
        delegated(node).call(node, new Event('click'));
    } catch (error) {
        thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.ob_type).toBeUndefined();
    expect(thrown.message).toContain('handler failed');
});

// A coroutine's failure has nobody to return to: it is thrown on a later turn,
// as an `Error`, which is what the page's `error` event reports.
test.for([['by name', 'later'], ['in a spread', 'later-spread']])('an async Python handler written %s reports an ordinary Error', async ([, key]) => {
    const node = mounted(DomHandlers)(key);
    const original = globalThis.setTimeout;
    const pending = [];

    globalThis.setTimeout = (fn, ...rest) => (typeof fn === 'function' && rest.length === 0 ? pending.push(fn) : original(fn, ...rest));

    try {
        delegated(node).call(node, new Event('click'));
        await vi.waitFor(() => expect(pending).toHaveLength(1));
    } finally {
        globalThis.setTimeout = original;
    }

    let thrown;
    try {
        pending[0]();
    } catch (error) {
        thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.ob_type).toBeUndefined();
    expect(thrown.message).toContain('handler failed later');
});
