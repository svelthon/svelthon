import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Derived from './fixtures/Derived.svelte';
import UnusedDerivedGenerator from './fixtures/UnusedDerivedGenerator.svelte';
import UnusedDerivedGeneratorNative from './fixtures/UnusedDerivedGeneratorNative.svelte';

// @derived turns a function into a value: Python reads the name and gets the
// result, like a @property. The body runs inside $derived.by, and every global
// it touches goes through a namespace accessor — so Svelte discovers the
// dependencies by itself, with nothing declared.
describe('@derived', () => {
    const setup = () => {
        const t = document.body.appendChild(document.createElement('div'));
        mount(Derived, { target: t });
        return {
            read: (k) => t.querySelector(`p[data-k="${k}"]`).textContent,
            rename: () => {
                t.querySelector('button[data-k="rename"]').click();
                flushSync();
            }
        };
    };

    test('the value is computed on read', () => {
        const { read } = setup();
        expect(read('full')).toBe('Ada Lovelace');
    });

    test('it recomputes when a dependency changes', () => {
        const { read, rename } = setup();

        expect(read('full')).toBe('Ada Lovelace');
        rename();
        expect(read('full')).toBe('Grace Lovelace');
    });

    test('a @derived can read another one, by name', () => {
        const { read, rename } = setup();

        expect(read('shouted')).toBe('ADA LOVELACE');
        rename();
        expect(read('shouted')).toBe('GRACE LOVELACE');
    });
});

// **A derived nothing reads is never run**, generators or not. The script's
// frame, holding a generator as it ended, was walked by the engine to close
// them, which read every name of the namespace, an unused derived included: it
// ran, and its error stopped the mount. The namespace outlives that frame, so
// the walk is not its: a generator suspended inside a `with` is still open, as
// it is in CPython once a module's body has run.
test.for([
    ['Python', UnusedDerivedGenerator],
    ['Svelte', UnusedDerivedGeneratorNative]
])('%s: an unused derived stays unrun beside a generator the script makes', ([language, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });

    flushSync();

    expect([...target.querySelectorAll('[data-k="row"]')].map((one) => one.textContent)).toEqual(['a', 'b']);
    if (language === 'Python') expect(instance.exited()).toBe(false);
});
