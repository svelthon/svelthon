// **A store function JavaScript kept is the function it read**: the name is
// live, so reading it again follows its next binding, and what was read keeps
// calling what it was, as a function kept from a JavaScript module does. A
// `def` crossed as its name's own wrapper, which called whatever the name held
// at the call: the next function once the name was bound again, an error once
// it was deleted, and two names holding one function crossed as two. And so an
// instance's `@export`, which a parent holding `bind:this` keeps.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as module from './fixtures/kept_function_store.svelte.py';
import KeptApi from './fixtures/KeptApi.svelte';

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
