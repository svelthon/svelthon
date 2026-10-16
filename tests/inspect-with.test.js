import { test, expect, describe, beforeEach } from 'vitest';
import { createRequire } from 'node:module';
import { mount, flushSync } from './mounted.js';
import InspectWith from './fixtures/InspectWith.svelte';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

// `$inspect(x).with(fn)` chains, and Python cannot spell it: `with` is a keyword
// and `with=` is not an argument name either. A keyword argument was the first
// answer and it costs a parser — `$inspect` is variadic, so pulling one named
// argument out of the list means splitting the source at depth zero. Putting the
// callable first needs no parsing: the split happens on the evaluated list, where
// position is reliable, and it is where Python puts a callable anyway —
// `map(fn, *iterables)`, `filter(fn, it)`, `reduce(fn, it)`.
describe('inspect_with', () => {
    beforeEach(() => {
        globalThis.__inspected = [];
    });

    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(InspectWith, { target });
        flushSync();

        return () => {
            target.querySelector('button').click();
            flushSync();
        };
    };

    test('the callback replaces the logger, and runs on init', () => {
        setup();

        expect(globalThis.__inspected).toContain('init:0,hello');
    });

    // The trap this shape exists to avoid: reading the values once into a
    // variable puts them outside the tracking context, and the callback then
    // fires on init and never again.
    test('and again on every change, with the new values', () => {
        const bump = setup();

        bump();
        expect(globalThis.__inspected).toContain('update:1,hello');
    });

    test('the kind comes first, then the values in the order given', () => {
        const bump = setup();
        bump();

        expect(globalThis.__inspected.filter((one) => one.startsWith('init:'))).toEqual([
            'init:0,hello'
        ]);
        expect(globalThis.__inspected.filter((one) => one.startsWith('update:'))).toEqual([
            'update:1,hello'
        ]);
    });

    // Svelte calls the callback with the kind and every value; a Python function
    // that declares fewer parameters is trimmed rather than raising.
    test('a callback narrower than the call is trimmed, not broken', () => {
        setup();

        expect(globalThis.__inspected).toContain('trimmed:init');
    });

    test('two of them coexist, each with its own callback', () => {
        const bump = setup();
        bump();

        expect(globalThis.__inspected).toContain('update:1,hello');
        expect(globalThis.__inspected).toContain('trimmed:update');
    });
});

// The logger is the first argument, which a call by keywords alone or a starred
// one does not have: the compiler read the end of an argument that was not there
// and raised a JavaScript `TypeError` of its own. Refused at the line instead.
test('inspect_with without a logger first is refused at its line', () => {
    for (const call of ['inspect_with(**options)', 'inspect_with(*values)']) {
        let error;

        try {
            compile(`options = {}\nvalues = []\n${call}\n`, 'Probe', 'src/probe.svelte', {});
        } catch (thrown) {
            error = thrown;
        }

        expect(error?.message).toMatch(/`inspect_with` takes the function that logs first/);
        expect(error.start.line).toBe(3);
    }
});
