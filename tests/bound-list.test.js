import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BoundList from './fixtures/BoundList.svelte';
import BoundListNative from './fixtures/BoundListNative.svelte';
import BoundListHost from './fixtures/BoundListHost.svelte';

// A list a Python child replaces is the one its JavaScript parent then holds:
// what the parent pushes into it, the child sees, and what the child appends,
// the parent sees, as between two Svelte components.
const steps = (Child) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BoundListHost, { target, props: { Child } });
    flushSync();

    const read = () =>
        `${target.querySelector('[data-k="parent"]').textContent} / ${target.querySelector('[data-k="child"]').textContent}`;
    const out = [read()];

    instance.reset();
    flushSync();
    out.push(read());

    target.querySelector('button').click();
    flushSync();
    out.push(read());

    instance.grow();
    flushSync();
    out.push(read());

    return out;
};

test('a bound list replaced by a Python child stays shared with its JavaScript parent', () => {
    expect(steps(BoundList)).toEqual(steps(BoundListNative));
});

test('the Svelte child is the rule', () => {
    expect(steps(BoundListNative)).toEqual(['[] / ', '[] / ', '[7] / 7', '[7,8] / 7,8']);
});
