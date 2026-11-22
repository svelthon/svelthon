// @vitest-environment node
import { test, expect, beforeEach } from 'vitest';
import * as module from './fixtures/globals_dict.py';
import * as moduleLocals from './fixtures/module_locals.py';
import * as ordered from './fixtures/globals_order.py';
import * as orderedStore from './fixtures/globals_order_store.svelte.py';
import * as walked from './fixtures/globals_walked.py';

// `globals()` is the module's own dict, as CPython hands it over: its class and
// its keys, read (`namespace-read-only.test.js` for a write). The expected
// strings are what CPython answers for the same file, step by step, each step
// after `restore()`. Its names are the module's: no word the compiler adds is
// one of them.
beforeEach(() => module.restore());

test.each([
    ['kind', 'dict|True|True'],
    ['names', 'count,kind,label,names,reads,restore,top,top_dir,top_locals,unbound'],
    ['reads', 'True|True|True|3|3|3|x|True'],
    ['top', 'True|True|True|False'],
    // A name never bound, read from a function.
    ['unbound', 'missing']
])('globals() answers %s as CPython does', (step, cpython) => {
    expect(module[step]()).toBe(cpython);
});

// The order the names were bound in, which the accessors of a module are not
// in: the compiler declares its values, then its functions, and a class has
// none, written on the namespace itself. Read forwards, backwards and copied;
// then with a name bound again, which keeps its place. `python3` on the same
// file.
test.each([
    ['a module', ordered],
    ['a reactive module', orderedStore]
])('globals() lists the names of %s in the order they were bound', (_, one) => {
    // A reactive module hands its Python list over itself.
    const rows = (lists) => Array.from(lists, (row) => Array.from(row));
    const bound = [
        ['first', 'middle', 'Middle', 'last'],
        ['last', 'Middle', 'middle', 'first'],
        ['first', 'middle', 'Middle', 'last']
    ];

    expect(rows(one.listed())).toEqual(bound);
    expect(rows(one.replaced())).toEqual(bound);
});

// A name bound or deleted while `globals()` is walked changes its size, and
// the walk raises: a variable, a class and a function bound by `global`, a
// `del`, and a class and a variable bound at the top of the module, whose class
// had no accessor and was seen by no one. A name bound again does not. Counted
// as the namespace is written, so a walk costs what it did. `python3` on the
// same file.
test('a name bound or deleted while globals() is walked ends the walk as in CPython', () => {
    expect([...walked.seen]).toEqual([
        'variable RuntimeError',
        'class RuntimeError',
        'function RuntimeError',
        'existing ok',
        'delete RuntimeError',
        'top class RuntimeError',
        'top variable RuntimeError'
    ]);
});

// `locals()` at the top of a module is the module's dict, and refuses an
// argument as it does in a function: the module's answer skipped the check.
// `python3` on the same file.
test('locals() refuses an argument at the top of a module as in a function', () => {
    const refusals = ['TypeError', 'TypeError', 'TypeError', 'TypeError', 'accepted'];

    expect(moduleLocals.top).toEqual([...refusals, true]);
    expect(moduleLocals.inside()).toEqual(refusals);
});
