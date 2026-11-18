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
import GroupHydrateValues from './fixtures/GroupHydrateValues.svelte';
import GroupHydrateValuesNative from './fixtures/GroupHydrateValuesNative.svelte';
import GroupHydrateSplit from './fixtures/GroupHydrateSplit.svelte';
import GroupHydrateSplitNative from './fixtures/GroupHydrateSplitNative.svelte';
import GroupHydrateMoving from './fixtures/GroupHydrateMoving.svelte';
import GroupHydrateMovingNative from './fixtures/GroupHydrateMovingNative.svelte';
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

// A group whose values the markup evaluates keeps what the server checked once
// hydrated, and a click adds to its model. Hydration takes the default `value`
// attribute away with `set_attribute(input, 'value', null)`, which writes the
// `null` into the cache the group read the field's value from: the boxes were
// all unticked, and a click gave `[None]`.
test.for([
    ['Python', GroupHydrateValues],
    ['Svelte', GroupHydrateValuesNative]
])('%s: a hydrated group of evaluated values keeps its choice', async ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const q = (k) => target.querySelector(`[data-k="${k}"]`);
    const ticked = () => ['box-a', 'box-b', 'radio-a', 'radio-b'].map((k) => q(k).checked);

    target.innerHTML = html.GroupHydrateValues;
    hydrated.push(hydrate(Component, { target }));
    flushSync();
    await Promise.resolve();
    flushSync();

    expect(ticked()).toEqual([true, false, true, false]);

    q('box-b').click();
    flushSync();
    q('radio-b').click();
    flushSync();

    expect(ticked()).toEqual([true, true, false, true]);
    expect(q('model').textContent).toBe('a,b|b');
});

// And what the reader picked before the script ran is theirs there too: that
// `null` is no new value of the field, and shown as one, it put the server's
// model back over the reader's boxes before the group read them.
test.for([
    ['Python', GroupHydrateValues],
    ['Svelte', GroupHydrateValuesNative]
])('%s: a group of evaluated values keeps what the reader picked before hydrating', async ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const q = (k) => target.querySelector(`[data-k="${k}"]`);

    target.innerHTML = html.GroupHydrateValues;
    q('box-b').click();
    q('box-a').click();
    q('radio-b').click();
    hydrated.push(hydrate(Component, { target }));
    flushSync();
    await Promise.resolve();
    flushSync();

    expect(['box-a', 'box-b', 'radio-a', 'radio-b'].map((k) => q(k).checked)).toEqual([false, true, false, true]);
    expect(q('model').textContent).toBe('b|b');
});

// A radio of another binding picked before hydrating unchecks the first
// binding's, whose model is then the group's checked input, none, as Svelte
// reads it: kept, the model held the server's choice the page no longer showed,
// and a handler confirming it sent that.
test.for([
    ['Python', 'other', '|other', GroupHydrateSplit],
    ['Svelte', 'other', '|other', GroupHydrateSplitNative],
    ['Python', 'mail', 'mail|', GroupHydrateSplit],
    ['Svelte', 'mail', 'mail|', GroupHydrateSplitNative]
])('%s: the radio %s picked before hydrating leaves each binding its checked input', async ([, picked, model, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const q = (k) => target.querySelector(`[data-k="${k}"]`);

    target.innerHTML = html.GroupHydrateSplit;
    q(picked).click();
    hydrated.push(hydrate(Component, { target }));
    flushSync();
    await Promise.resolve();
    flushSync();

    expect([['email', 'mail', 'other'].filter((k) => q(k).checked), q('model').textContent]).toEqual([[picked], model]);
});

// And the value it keeps is the one its field holds, evaluated once: past that
// `null`, the group read the value compiled again for it, which an expression
// answering anew at each call gave otherwise, and a click wrote `v-2` for a
// field holding `v-1`.
test.for([
    ['Python', GroupHydrateMoving],
    ['Svelte', GroupHydrateMovingNative]
])('%s: a hydrated group writes the value its field holds', async ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const q = (k) => target.querySelector(`[data-k="${k}"]`);

    target.innerHTML = html.GroupHydrateMoving;
    hydrated.push(hydrate(Component, { target }));
    flushSync();
    await Promise.resolve();
    flushSync();

    q('radio').click();
    flushSync();
    q('box').click();
    flushSync();

    expect([q('radio').checked, q('box').checked]).toEqual([true, true]);
    expect(q('model').textContent).toBe(`${q('radio').value}|${q('box').value}`);
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
