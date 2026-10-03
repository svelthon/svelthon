// A child taken out of a container no longer reaches what reads the container,
// and a subclass of a list, a dict or a set lets go of it as the builtin does.
// What a subclass holds another way, an attribute of its instance or of its
// class, still reaches its readers.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SubclassDetach from './fixtures/SubclassDetach.svelte';
import SharedShelf from './fixtures/SharedShelf.svelte';
import IndexedShelf from './fixtures/IndexedShelf.svelte';

const run = (props, steps) => {
    const calls = [];
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(SubclassDetach, { target, props: { ...props, notify: (n) => calls.push(n) } });

    flushSync();

    for (const step of steps) {
        instance[step]();
        flushSync();
    }

    return { calls, asked: instance.asked(), shown: target.querySelector('p').textContent };
};

describe.for(['list', 'dict', 'set'])('a %s subclass', (kind) => {
    test.for([
        ['empty of its own', 'filled', ['detach', 'mutate']],
        ['with an __init__ of its own', 'initialised', ['detach', 'mutate']],
        ['given the child after the watch began', 'appended', ['add', 'detach', 'mutate']]
    ])('%s lets go of a child it no longer holds, as the builtin does', ([, shape, steps]) => {
        const native = run({ kind, shape }, steps);
        const derived = run({ kind, shape, subclass: true }, steps);

        // The witness: the builtin is called at mount and at each step but the
        // mutation of the child it let go of.
        expect(native.calls).toHaveLength(steps.length);
        expect(derived.calls).toEqual(native.calls);
        expect(derived.shown).toBe('1');
    });

    test('keeps a child an attribute of the instance still holds', () => {
        expect(run({ kind, shape: 'kept', subclass: true }, ['detach', 'mutate']).calls).toEqual([1, 0, 0]);
    });
});

// Checking the link reads the dict's own table: neither a `__missing__` nor a
// `__getitem__` of the author's is run by the asking.
test.for([
    ['a __missing__', 'missing'],
    ['a __getitem__', 'counted']
])('a dict subclass with %s is not called while its links are checked', ([, shape]) => {
    expect(run({ kind: 'dict', shape, subclass: true }, ['detach', 'mutate']).asked).toBe(0);
});

// And what a subclass hands out by a route of its own: an attribute of its
// class, and a `__getitem__` that gives what its storage does not hold.
test.for([
    ['from its class', SharedShelf],
    ['by a __getitem__ of its own', IndexedShelf]
])('a child a subclass hands out %s is still shown after it is emptied', ([, component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(component, { target });

    flushSync();
    instance.detach();
    flushSync();
    instance.mutate();
    flushSync();

    expect(target.querySelector('p').textContent).toBe('1');
});
