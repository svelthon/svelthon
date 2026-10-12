// @vitest-environment node
import { test, expect, beforeEach } from 'vitest';
import * as module from './fixtures/globals_dict.py';
import * as moduleLocals from './fixtures/module_locals.py';
import * as ordered from './fixtures/globals_order.py';
import * as orderedStore from './fixtures/globals_order_store.svelte.py';

// `globals()` is the module's own dict, as CPython hands it over: its class,
// its keys, a write that makes a global and a deletion that removes one. The
// expected strings are what CPython answers for the same file, step by step,
// each step after `restore()`. Its names are the module's: no word the
// compiler adds is one of them.
beforeEach(() => module.restore());

test.each([
    ['kind', 'dict|True|True'],
    [
        'names',
        'added_value,count,deleted,kind,label,names,popped,popped_read,reads,restore,top,top_dir,top_locals,unbound,writes'
    ],
    ['reads', 'True|True|True|3|3|3|x|True'],
    ['writes', '5'],
    ['popped', 'x|False'],
    ['deleted', 'False'],
    ['top', 'True|True|True|False'],
    // A name never bound, and one popped from globals(), read from a function.
    ['unbound', 'missing'],
    ['popped_read', 'missing']
])('globals() answers %s as CPython does', (step, cpython) => {
    expect(module[step]()).toBe(cpython);
});

// The order the names were bound in, which the accessors of a module are not
// in: the compiler declares its values, then its functions. Read forwards,
// backwards and copied; then with a name popped and put back, which goes last,
// and with a name written again, which keeps its place. `python3` on the same
// file.
test.each([
    ['a module', ordered],
    ['a reactive module', orderedStore]
])('globals() lists the names of %s in the order they were bound', (_, one) => {
    // A reactive module hands its Python list over itself.
    const rows = (lists) => Array.from(lists, (row) => Array.from(row));
    const moved = [
        ['middle', 'last', 'first'],
        ['first', 'last', 'middle'],
        ['middle', 'last', 'first']
    ];

    expect(rows(one.listed())).toEqual([
        ['first', 'middle', 'last'],
        ['last', 'middle', 'first'],
        ['first', 'middle', 'last']
    ]);
    expect(rows(one.moved())).toEqual(moved);
    expect(rows(one.replaced())).toEqual(moved);
});

// `locals()` at the top of a module is the module's dict, and refuses an
// argument as it does in a function: the module's answer skipped the check.
// `python3` on the same file.
test('locals() refuses an argument at the top of a module as in a function', () => {
    const refusals = ['TypeError', 'TypeError', 'TypeError', 'TypeError', 'accepted'];

    expect(moduleLocals.top).toEqual([...refusals, true]);
    expect(moduleLocals.inside()).toEqual(refusals);
});
