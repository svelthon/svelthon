import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';

import JsAttrs from './fixtures/JsAttrs.svelte';
import PyAttrs from './fixtures/PyAttrs.svelte';

// This file does not check what SVELTHON does, but that it does *the same thing*
// as Svelte. The two components are word for word the same, one in Python with a
// dict and a list mutated in place, the other in JavaScript with a deeply
// proxied $state. Any line that diverged here is a bug — unless the divergence
// was chosen, and then it gets documented.

const render = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    return {
        el: (k) => target.querySelector(`[data-k="${k}"]`),
        mutate: () => {
            target.querySelector('button').click();
            flushSync();
        }
    };
};

describe.each([
    ['JavaScript', JsAttrs],
    ['Python', PyAttrs]
])('in-place mutation, attributes — %s', (_language, Component) => {
    test('a spread propagates', () => {
        const { el, mutate } = render(Component);

        expect(el('spread').getAttribute('data-n')).toBe('0');
        mutate();
        expect(el('spread').getAttribute('data-n')).toBe('1');
    });

    test('an attribute whose value is computed propagates', () => {
        const { el, mutate } = render(Component);

        expect(el('attr').getAttribute('title')).toBe('a');
        mutate();
        expect(el('attr').getAttribute('title')).toBe('a,b');
    });

    test('an attribute carrying the container itself does not propagate', () => {
        const { el, mutate } = render(Component);

        // Neither here nor in JavaScript: Svelte compares the value to the one
        // it wrote last time, by identity, and a mutated container is the same
        // object. This is not a SVELTHON limitation, it is the host's own
        // semantics — and this test is here to prove it on both sides.
        expect(el('raw').getAttribute('title')).toBe('a');
        mutate();
        expect(el('raw').getAttribute('title')).toBe('a');
    });
});
