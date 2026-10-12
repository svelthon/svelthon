// `del` on a published name, as a product of the kinds of name and the ways a
// name comes back, with the same contract in every cell.
//
// The contract: once deleted, a read raises NameError and the name is not in
// `globals()`, and deleting evaluates nothing; a write brings it back, whoever
// makes it. It was repaired one kind at a time over four audits, each finding
// the next kind: an accessor left present, a store setter that did not restore,
// a prop whose getter converts and so never reads the same twice, a derived
// whose getter runs the body just removed. What the deletion watches is the
// name's stored value, which `bind` is handed as its source, never what the
// getter makes of it.
//
// A new kind of published name adds a row here.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DelMatrixHost from './fixtures/DelMatrixHost.svelte';
import LazyDelete from './fixtures/LazyDelete.svelte';
import store from './fixtures/del_matrix.svelte.py';

const host = () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(DelMatrixHost, { target });
    flushSync();
    return instance;
};

const COMPONENT = [
    ['an int prop', 'count', '7'],
    ['a float prop', 'level', '7'],
    ['a bindable', 'rows', '[7]'],
    ['a state', 'state', '7'],
    ['a function', 'helper', '7'],
    ['a derived', 'twice', '7']
];

describe.for(COMPONENT)('in a component, %s', ([, name, rebound]) => {
    test('is absent once deleted, and stays absent', () => {
        const instance = host();

        expect(instance.seen(name)).toMatch(/ True$/);
        instance.drop(name);
        flushSync();
        expect(instance.seen(name)).toBe('NameError False');
        expect(instance.seen(name)).toBe('NameError False');
    });

    test('comes back when Python binds it', () => {
        const instance = host();

        instance.drop(name);
        instance.rebind(name);
        flushSync();
        expect(instance.seen(name)).toBe(`${rebound} True`);
    });
});

describe.for([
    ['an int prop', 'count', '2'],
    ['a float prop', 'level', '0.75']
])('in a component, %s', ([, name, passed]) => {
    test('comes back when its parent passes a new value', () => {
        const instance = host();

        instance.drop(name);
        flushSync();
        expect(instance.seen(name)).toBe('NameError False');

        instance.pass(name);
        flushSync();
        expect(instance.seen(name)).toBe(`${passed} True`);
    });
});

// Svelte's rule, which the rows above lean on: a child's write overrides what
// its parent passed, until the parent passes a new value.
test.for([
    ['count', '7', '2'],
    ['level', '7', '0.75']
])('a prop %s the child writes overrides its parent, until the parent passes anew', ([name, written, passed]) => {
    const instance = host();

    instance.rebind(name);
    flushSync();
    expect(instance.seen(name)).toBe(`${written} True`);

    instance.pass(name);
    flushSync();
    expect(instance.seen(name)).toBe(`${passed} True`);
});

test('in a component, a state comes back when a loop binds it', () => {
    const instance = host();

    instance.drop('state');
    instance.rebindByLoop('state');
    flushSync();
    expect(instance.seen('state')).toBe('8 True');
});

describe.for([
    ['a state', 'state'],
    ['a function', 'helper'],
    ['a derived', 'twice']
])('in a store, %s', ([, name]) => {
    test('is absent once deleted, and comes back when Python binds it', () => {
        expect(store.seen(name)).toMatch(/ True$/);
        store.drop(name);
        expect(store.seen(name)).toBe('NameError False');
        expect(store.seen(name)).toBe('NameError False');

        store.rebind(name);
        expect(store.seen(name)).toBe('7 True');
    });
});

test("in a store, a state comes back through the store's setter", () => {
    store.drop('state');
    expect(store.seen('state')).toBe('NameError False');

    store.state = 9;
    expect(store.seen('state')).toBe('9 True');
});

// Deleting a derived nothing read yet: asking whether the name is there read
// its value, which ran the body, and a body that raises stopped the deletion.
test('deleting a derived never read runs nothing', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(LazyDelete, { target });
    flushSync();

    expect(instance.drop()).toBe('deleted');
});
