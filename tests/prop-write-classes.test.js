// A child writing over what a Python parent passed, which Svelte compares with
// `===`: the object the prop holds is handed back only when the write is of
// its exact class, float, int or str, and of its value, so that the two are
// one to Python too. `2` written over the parent's `2.0` is the child's int, an
// instance of a subclass the child's own whatever its value; and a question
// about the module's names, which reads the prop where it is held, between the
// parent's write and the child's, decides nothing otherwise.
import { test, expect } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import PropClassesHost from './fixtures/PropClassesHost.svelte';
import PropClassesHostNative from './fixtures/PropClassesHostNative.svelte';

const shown = (host, target) => `${host.model()} | ${target.querySelector('p').textContent}`;

const run = (Host, steps) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(Host, { target });

    flushSync();
    for (const [step, kind, flush] of steps) {
        host[step](kind);
        if (flush) flushSync();
    }
    flushSync();

    const seen = shown(host, target);

    unmount(host);
    target.remove();

    return seen;
};

test.for([
    ['float2', 'int2', 'int 2'],
    ['int2', 'float2', 'float 2.0'],
    ['int1', 'true', 'bool True'],
    ['sub2', 'int2', 'int 2'],
    ['shared2', 'shared2', 'Shared 2 child-2']
])('the parent passes %s, the child writes %s: it reads %s', ([given, kind, expected]) => {
    expect(run(PropClassesHost, [['give', given, true], ['own', kind, true]])).toBe(`${expected} | ${expected}`);
});

// The parent's second value not read yet, the names read or asked about, then
// the child writes the parent's second value.
test.for([
    ['peek', 'half', 'other', 'float 0.75'],
    ['ask', 'half', 'other', 'float 0.75'],
    ['peek', 'shared1', 'shared2', 'Shared 2 child-2'],
    ['ask', 'shared1', 'shared2', 'Shared 2 child-2']
])('after %s, the child writing the parent\'s %s then %s reads %s', ([read, first, second, expected]) => {
    const steps = [['give', first, true], ['give', second, false], [read, undefined, false], ['own', second, true]];

    expect(run(PropClassesHost, steps)).toBe(`${expected} | ${expected}`);
    if (expected.startsWith('float')) expect(run(PropClassesHostNative, steps)).toBe(`${expected} | ${expected}`);
});
