// @vitest-environment node
import { test, expect, beforeEach } from 'vitest';
import * as module from './fixtures/globals_dict.py';

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
