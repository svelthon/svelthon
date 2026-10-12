// The names of a component's module are there by what each holds at its
// source, so listing or counting them runs no derived: asking whether a name
// is in `globals()` read its value, and a body that raises stopped the
// question. Its value is still read when the values are asked for.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import LazyNames from './fixtures/LazyNames.svelte';
import NamespaceIteration from './fixtures/NamespaceIteration.svelte';

test('listing the names of a module runs none of its derived, reading its values does', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(LazyNames, { target });
    flushSync();

    expect([...instance.names()]).toEqual([true, true, true]);
    expect(instance.values()).toBe('read');
});

// Backwards too: the reverse walk is a second path through the dict.
test('listing the names of a module backwards runs none of its derived', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(LazyNames, { target });
    flushSync();

    expect([...instance.reversed_names()]).toEqual([true, true]);
    expect(instance.reversed_values()).toBe('read');
});

// Walked lazily, the names still notice a key added through the dict, as
// CPython's walk does; a value replaced is no change of shape.
test('walking the globals of a module stops at a key added meanwhile, not at a value replaced', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(NamespaceIteration, { target });
    flushSync();

    for (const form of ['iter', 'keys', 'items', 'values']) {
        expect(instance.walk(form, 'add')).toBe('RuntimeError');
        expect(instance.walk(form, 'replace')).toBe('went on');
    }
});
