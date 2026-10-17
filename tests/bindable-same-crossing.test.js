// **A write to a bindable prop repaints what reads it once Python holds
// another value**, even when JavaScript holds the same: `15` written where
// `15.0` was, and `15.0` where a parent's `15` was, cross as one number. Svelte
// saw no change, the page kept the old value, and Python's own read gave the
// new one.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BindableFallbackKept from './fixtures/BindableFallbackKept.svelte';
import BindableFallbackKeptHost from './fixtures/BindableFallbackKeptHost.svelte';

const shown = (target) => target.querySelector('[data-k="child"]').textContent.split('|')[0];

test.for([
    ['an integer where its float default was, with no parent', BindableFallbackKept, {}, 'whole', '15'],
    ['a float where the integer its parent binds was', BindableFallbackKeptHost, { start: 15 }, 'floated', '15.0']
])('%s shows what Python holds', ([, Component, props, write, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });

    flushSync();
    instance[write]();
    flushSync();

    expect(instance.held()).toBe(expected);
    expect(shown(target)).toBe(expected);
});
