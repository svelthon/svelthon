// The names of a component's module are there by what each holds at its
// source, so listing or counting them runs no derived: asking whether a name
// is in `globals()` read its value, and a body that raises stopped the
// question. Its value is still read when the values are asked for.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import LazyNames from './fixtures/LazyNames.svelte';

test('listing the names of a module runs none of its derived, reading its values does', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(LazyNames, { target });
    flushSync();

    expect([...instance.names()]).toEqual([true, true, true]);
    expect(instance.values()).toBe('read');
});
