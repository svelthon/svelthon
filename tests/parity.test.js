import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';

import JsAttrs from './fixtures/JsAttrs.svelte';
import PyAttrs from './fixtures/PyAttrs.svelte';

// This file does not check what Svelthon does, but that it does *the same thing*
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
])('in-place mutation, attributes — %s', (language, Component) => {
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

    test('an attribute carrying the container itself', () => {
        const { el, mutate } = render(Component);
        const title = () => el('raw').getAttribute('title');

        // The one divergence chosen here. JavaScript writes the array's own
        // text, and Svelte, which compares the value to the one it wrote last
        // time by identity, keeps it after a change in place: the same object.
        // Python writes the list as Python writes it, as it does with text
        // around it, and that text is another once the list has changed.
        const before = title();

        mutate();
        expect([before, title()]).toEqual(language === 'Python' ? ["['a']", "['a', 'b']"] : ['a', 'a']);
    });
});
