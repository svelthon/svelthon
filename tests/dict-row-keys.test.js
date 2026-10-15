// @vitest-environment node
//
// Updating a row of a watched dict checks that the dict still holds it, by
// reading the one entry under the key the row was linked with. A row linked
// without its key was searched for through every entry instead: `setdefault`
// linked the value it hands back with no key, so filling a table with it and
// then updating each row once read n² entries. Counted here by the entries the
// dict's own iteration produces.
import { test, expect } from 'vitest';
import { track, unsubscribe } from '../src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const list = (items) => $B.builtins.list.$factory(items);
const call = (obj, name, ...args) => $B.$call($B.$getattr(obj, name), ...args);
const dictOf = (key, value) => {
    const dict = $B.empty_dict();

    $B.$setitem(dict, key, value);

    return dict;
};

const n = 256;

function updates(fill) {
    const parent = $B.empty_dict();
    const children = Array.from({ length: n }, () => list([]));
    const owner = [];
    let bumps = 0;

    track(parent, () => bumps++, owner);
    const rows = fill(parent, children);

    const original = $B.builtins.dict.$iter_items;
    let scanned = 0;

    $B.builtins.dict.$iter_items = function* (dict) {
        for (const entry of original(dict)) {
            if (dict === parent) scanned++;
            yield entry;
        }
    };

    const before = bumps;

    try {
        for (const row of rows) call(row, 'append', 1);
    } finally {
        $B.builtins.dict.$iter_items = original;
        unsubscribe(owner);
    }

    return { bumps: bumps - before, scanned };
}

// Filling a watched dict one row at a time by keyword: the keywords arrive in a
// carrier under `$B.KW` that was taken for a source nobody could read again, so
// every call walked the whole dict, n(n + 1) / 2 entries for n rows. Counted
// here while the table is filled.
test.each([
    ['update(**source)', (key, row) => [{ [$B.KW]: [{}, dictOf(key, row)] }]],
    ['update(key=row)', (key, row) => [{ [$B.KW]: [{ [key]: row }] }]],
    ['update(source, **more)', (key, row) => [dictOf(`${key}-a`, list([])), { [$B.KW]: [{}, dictOf(key, row)] }]]
])('filling a dict with %s reads none of its entries again', (_, args) => {
    const parent = $B.empty_dict();
    const owner = [];

    track(parent, () => {}, owner);

    const original = $B.builtins.dict.$iter_items;
    let scanned = 0;

    $B.builtins.dict.$iter_items = function* (dict) {
        for (const entry of original(dict)) {
            if (dict === parent) scanned++;
            yield entry;
        }
    };

    try {
        for (let i = 0; i < n; i++) call(parent, 'update', ...args(`row-${i}`, list([])));
    } finally {
        $B.builtins.dict.$iter_items = original;
        unsubscribe(owner);
    }

    expect(scanned).toBe(0);
});

test.each([
    [
        'written by subscript',
        (parent, children) => {
            children.forEach((child, i) => $B.$setitem(parent, `row-${i}`, child));
            return children;
        }
    ],
    [
        'added by setdefault',
        (parent, children) => children.map((child, i) => call(parent, 'setdefault', `row-${i}`, child))
    ],
    [
        'handed back by setdefault, the key already there',
        (parent, children) => {
            children.forEach((child, i) => $B.$setitem(parent, `row-${i}`, child));
            return children.map((_, i) => call(parent, 'setdefault', `row-${i}`, list([])));
        }
    ]
])('a row %s is checked by its key', (_, fill) => {
    expect(updates(fill)).toEqual({ bumps: n, scanned: 0 });
});
