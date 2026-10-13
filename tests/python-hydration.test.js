// The client half: hydrating what the server rendered for a Python component.
// Svelte keeps the server's nodes, says nothing about a mismatch, and the
// Python is wired to what it kept: the same page, then alive.
import { test, expect, vi, afterEach } from 'vitest';
import { hydrate, mount, flushSync, unmount } from 'svelte';
import PythonTruthAttributes from './fixtures/PythonTruthAttributes.svelte';
import KeyIdentity from './fixtures/KeyIdentity.svelte';
import SvelteConstructs from './fixtures/SvelteConstructs.svelte';
import ScalarProps from './fixtures/ScalarProps.svelte';
import GroupHydrate from './fixtures/GroupHydrate.svelte';
import GroupCheckedWritten from './fixtures/GroupCheckedWritten.svelte';
import GroupCheckedWrittenNative from './fixtures/GroupCheckedWrittenNative.svelte';
import * as html from './fixtures/python-ssr-html.js';

const hydrated = [];

afterEach(() => {
    while (hydrated.length) unmount(hydrated.pop());
});

// Hydrates on the pinned HTML and reports the first node, and every warning
// Svelte gave about hydration.
const hydrateOn = (Component, name, props = {}) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const target = document.body.appendChild(document.createElement('div'));
    target.innerHTML = html[name];
    const first = target.firstElementChild;

    try {
        hydrated.push(hydrate(Component, { target, props }));
        flushSync();
    } finally {
        warn.mockRestore();
    }

    const warnings = warn.mock.calls.map((call) => String(call[0])).filter((one) => /hydrat/i.test(one));

    return { target, first, warnings, q: (selector) => target.querySelector(selector) };
};

test.for([
    ['Python truth on attributes and class', PythonTruthAttributes, 'PythonTruthAttributes', {}],
    ['keys by identity and by repr', KeyIdentity, 'KeyIdentity', {}],
    ['the everyday constructs of Svelte 5', SvelteConstructs, 'SvelteConstructs', {}],
    ['props given as JavaScript floats', ScalarProps, 'ScalarProps', { amount: 0.42, two_way: 0.42 }]
])('%s: the server nodes are kept, with no warning', ([, Component, name, props]) => {
    const { target, first, warnings } = hydrateOn(Component, name, props);

    expect(target.firstElementChild).toBe(first);
    expect(warnings).toEqual([]);
});

test('the attributes Python finds false stay off once hydrated', () => {
    const { q } = hydrateOn(PythonTruthAttributes, 'PythonTruthAttributes');

    expect(q('[data-k="hidden"]').hidden).toBe(false);
    expect(q('[data-k="witness"]').disabled).toBe(true);
    expect(q('[data-k="dict"]').className).toBe('shown');
});

test('a hydrated list follows its mutations', () => {
    const { q } = hydrateOn(KeyIdentity, 'KeyIdentity');
    const block = q('[data-k="block"]');

    q('[data-k="grow"]').click();
    flushSync();

    expect(q('[data-k="block"]')).toBe(block);
    expect(q('[data-k="block"]').textContent).toBe('2');
});

// A reader who ticks a box or picks a radio while the script is still loading
// keeps the choice: the control wins over the empty model the server rendered,
// and the model is rebuilt from it, as Svelte's own `bind:group` does. The
// group used to show its model at install and erase the click.
test('a group the reader changed before hydrating keeps the change', async () => {
    const target = document.body.appendChild(document.createElement('div'));

    target.innerHTML = html.GroupHydrate;
    target.querySelector('[data-k="box"]').click();
    target.querySelector('[data-k="radio"]').click();

    hydrated.push(hydrate(GroupHydrate, { target }));
    flushSync();
    await Promise.resolve();
    flushSync();

    expect([target.querySelector('[data-k="box"]').checked, target.querySelector('[data-k="radio"]').checked]).toEqual([
        true,
        true
    ]);
    expect(target.querySelector('[data-k="model"]').textContent).toBe('yes|yes');
});

// And a `checked` the markup writes is no click: Svelte sets the property and
// leaves the default to the template, so a fresh mount found the two apart and
// rebuilt an empty group from the control. Svelte's own group keeps its model,
// the witness beside it.
test.for([
    ['Python', GroupCheckedWritten],
    ['Svelte', GroupCheckedWrittenNative]
])('%s: a fresh mount keeps an empty group under a checked the markup writes', async ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));

    hydrated.push(mount(Component, { target }));
    flushSync();
    await Promise.resolve();
    flushSync();

    expect([target.querySelector('[data-k="box"]').checked, target.querySelector('[data-k="radio"]').checked]).toEqual([
        false,
        false
    ]);
    expect(target.querySelector('[data-k="model"]').textContent).toBe('|');
});

test('bind:this takes the node once hydrated, and the window its events', () => {
    const { q } = hydrateOn(SvelteConstructs, 'SvelteConstructs');

    expect(q('.el').textContent).toBe('DIV');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
    flushSync();

    expect(q('.keys').textContent).toBe('1');
});
