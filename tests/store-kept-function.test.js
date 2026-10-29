// **A store function JavaScript kept is the function it read**: the name is
// live, so reading it again follows its next binding, and what was read keeps
// calling what it was, as a function kept from a JavaScript module does. A
// `def` crossed as its name's own wrapper, which called whatever the name held
// at the call: the next function once the name was bound again, an error once
// it was deleted, and two names holding one function crossed as two.
import { test, expect } from 'vitest';
import * as module from './fixtures/kept_function_store.svelte.py';

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
