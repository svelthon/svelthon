// @vitest-environment node
//
// Updating a row of a watched list checks that the list still holds the row,
// and the check reads the one slot the row was last seen at. A row linked
// without its index was searched for instead, a whole-list read per update: a
// table loaded with `extend` after the watch began paid n(n + 1) / 2 reads to
// update each of its n rows once. Every way a row enters or moves is counted
// here, by the element reads any search of the list makes.
import { test, expect } from 'vitest';
import { track, unsubscribe } from '../src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const list = (items) => $B.builtins.list.$factory(items);
const call = (obj, name, ...args) => $B.$call($B.$getattr(obj, name), ...args);
const whole = () => $B.builtins.slice.$factory($B.builtins.None, $B.builtins.None, $B.builtins.None);

const n = 256;

// The reads a search of `parent` makes, whichever search it is.
function counting(parent) {
    const counter = { reads: 0 };
    const counted = new Proxy(parent, {
        get(target, key, receiver) {
            if (typeof key === 'string' && /^\d+$/.test(key)) counter.reads++;
            return Reflect.get(target, key, receiver);
        }
    });

    for (const name of ['includes', 'indexOf', 'lastIndexOf']) {
        Object.defineProperty(parent, name, {
            configurable: true,
            value: (value) => Array.prototype[name].call(counted, value)
        });
    }

    return counter;
}

function updates(load) {
    const children = Array.from({ length: n }, () => list([]));
    const parent = list([]);
    const owner = [];
    let bumps = 0;

    track(parent, () => bumps++, () => {}, owner);
    load(parent, children);

    const counter = counting(parent);
    const before = bumps;

    for (const child of children) call(child, 'append', 1);
    unsubscribe(owner);

    return { bumps: bumps - before, linear: counter.reads <= 4 * n };
}

const loads = {
    'extend after the watch began': (parent, children) => call(parent, 'extend', list(children)),
    'append, one row at a time': (parent, children) => children.forEach((child) => call(parent, 'append', child)),
    'insert at the front': (parent, children) => children.forEach((child) => call(parent, 'insert', 0, child)),
    'extend, then insert before every row': (parent, children) => {
        call(parent, 'extend', list(children));
        call(parent, 'insert', 0, list([]));
    },
    'extend, then reverse': (parent, children) => {
        call(parent, 'extend', list(children));
        call(parent, 'reverse');
    },
    'extend, then pop the first row': (parent, children) => {
        call(parent, 'extend', list([list([]), ...children]));
        call(parent, 'pop', 0);
    },
    'assign every slot through a slice': (parent, children) => call(parent, '__setitem__', whole(), list(children)),
    'assign each slot by a negative index': (parent, children) => {
        call(parent, 'extend', list(children.map(() => 0)));
        children.forEach((child, i) => call(parent, '__setitem__', i - n, child));
    },
    '+=': (parent, children) => {
        const sum = $B.$getattr(parent, '__iadd__');
        $B.$call(sum, list(children));
    }
};

test.each(Object.keys(loads))('%s: each row update reads a few slots', (name) => {
    expect(updates(loads[name])).toEqual({ bumps: n, linear: true });
});

// Moved where no mutator is seen, from JavaScript: the first check searches,
// and keeps the index it finds, so the next round reads one slot again.
test('a list reordered behind the watch is searched once', () => {
    const children = Array.from({ length: n }, () => list([]));
    const parent = list([]);
    const owner = [];

    track(parent, () => {}, () => {}, owner);
    call(parent, 'extend', list(children));
    Array.prototype.reverse.call(parent);

    for (const child of children) call(child, 'append', 1);

    // The list changes, so every row is checked again on its next update.
    call(parent, 'append', list([]));

    const counter = counting(parent);

    for (const child of children) call(child, 'append', 2);
    unsubscribe(owner);

    expect(counter.reads).toBeLessThanOrEqual(4 * n);
});
