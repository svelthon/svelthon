// One contract for an argument, whichever way the function was imported.
//
// A named import's arguments cross through `outbound`; a namespace, a default
// export, a nested member and `.new` go through the engine's `pyobj2jsobj`,
// which asks `$B.pyobj2jsobj_hook` first. The hook hands Python callables and
// containers to `outbound` with the memo the engine keeps for the call, so the
// six routes below answer alike: a list passed twice is one array, a cycle
// ends, a dict mutated between two calls is read afresh, and a list, tuple or
// dict subclass defining `__call__` is a callback. A method of a frozen
// object is one function across reads, so a registry can remove it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import EngineCrossing from './fixtures/EngineCrossing.svelte';

const routes = ['named', 'namespace', 'default', 'nested', 'named-new', 'namespace-new'];

const wanted = {
    alias: 'same',
    'nested-alias': 'same',
    'list-cycle': 'cycle',
    'dict-cycle': 'cycle',
    append: 'A;A|B',
    clear: 'rows;',
    callables: 'list,tuple,dict',
    none: 'undefined,null'
};

const read = (props) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(EngineCrossing, { target, props });
    flushSync();

    return target.querySelector('p').textContent;
};

test.each(routes.flatMap((route) => Object.keys(wanted).map((kind) => [route, kind])))(
    'through %s, %s',
    (route, kind) => {
        expect(read({ route, kind })).toBe(wanted[kind]);
    }
);

// What a library hands back is the value Python gave it, as the engine records
// it in `$B.PYOBJ_MAP`. Not through `.new`, which returns the instance.
test.each(['named', 'namespace', 'default', 'nested'])('through %s, a container handed back is the one given', (route) => {
    expect(read({ route, kind: 'returned' })).toBe('True,True');
});

test.each(['named', 'namespace'].flatMap((route) => ['frozen', 'sealed', 'nonextensible'].map((kind) => [route, kind])))(
    'through %s, a method of a %s object is removed by the name that added it',
    (route, kind) => {
        expect(read({ route, kind })).toBe('0');
    }
);
