// **A store function JavaScript kept is the function it read**: the name is
// live, so reading it again follows its next binding, and what was read keeps
// calling what it was, as a function kept from a JavaScript module does. A
// `def` crossed as its name's own wrapper, which called whatever the name held
// at the call: the next function once the name was bound again, an error once
// it was deleted, and two names holding one function crossed as two. And so an
// instance's `@export`, which a parent holding `bind:this` keeps.
//
// And it is the one JavaScript function published for the callable
// (`pyHandler`), the one a registry was handed when Python passed it, so the
// registry can remove it; and its answer crosses as data, a list as the view
// that keeps it. A wrapper of its own was another function than the one Python
// passed, and handed a list of floats as a copy made at each call, so a write
// to it was lost and nothing repainted.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as module from './fixtures/kept_function_store.svelte.py';
import KeptApi from './fixtures/KeptApi.svelte';
import HeldApi from './fixtures/HeldApi.svelte';
import HeldStoreView from './fixtures/HeldStoreView.svelte';
import heldStore from './fixtures/held_store.svelte.py';
import { registry } from './fixtures/kept_registry.js';
import nativeStore from './fixtures/native_store.svelte.py';
import { fraction } from './fixtures/native_calls.js';

test('a store function kept by JavaScript calls what it read, by the store and by its export', () => {
    const { store } = module;
    const kept = store.action;
    const exported = module.action;
    const same = [store.also === kept, exported === kept];

    store.rebind();
    const bound = [kept(), exported(), store.action(), store.action === kept];
    store.remove();

    expect([same, bound, kept(), exported(), store.action]).toEqual([
        [true, true],
        ['first', 'first', 'second', false],
        'first',
        'first',
        undefined
    ]);
});

test("an instance's exported function kept by its parent calls what it read", () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(KeptApi, { target });
    flushSync();
    const kept = instance.action;

    instance.rebind();
    const bound = [kept(), instance.action(), instance.action === kept];
    instance.remove();

    expect([bound, kept(), instance.action]).toEqual([['first', 'second', false], 'first', undefined]);
});

test('an exported or store function is the one a registry was handed, and the one returned', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(HeldApi, { target });
    flushSync();

    expect([
        registry.has(instance.action),
        instance.returned() === instance.action,
        registry.has(heldStore.action),
        registry.delete(instance.action) && registry.delete(heldStore.action),
        registry.size
    ]).toEqual([true, true, true, true, 0]);
});

// A JavaScript function a store holds crosses as itself: asked whether Python
// declared a signature, it crossed as the adapter Python calls it through,
// whose answer is a Python object, a float where `toFixed` is asked and an
// object where `undefined` was.
test('a JavaScript function a store holds crosses as itself, by any name', () => {
    expect([
        nativeStore.fraction === fraction,
        nativeStore.double === fraction,
        nativeStore.fraction(0.25).toFixed(2),
        nativeStore.absent()
    ]).toEqual([true, true, '0.50', undefined]);
});

test("a store function's list of floats is the list it holds, and a write to it repaints", () => {
    const first = heldStore.get_value();
    const same = first === heldStore.get_value();
    const target = document.body.appendChild(document.createElement('div'));
    const view = mount(HeldStoreView, { target });
    flushSync();
    const before = target.textContent;

    view.change();
    flushSync();

    expect([same, before, heldStore.read_value(), target.textContent]).toEqual([true, '0.25', 0.5, '0.5']);
});
