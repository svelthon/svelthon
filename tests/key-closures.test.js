// **The key of an `{#each}` binds every name what it reads reads**, a name a
// function a default made reads included: one walk back from the key passed
// `later` before `saved` named it, so `keyfn(saved())` read no `later`,
// `later is not defined`, or the component's own, and two rows keyed `99`
// were a duplicate. The server computes no key, so this is the client's.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import KeyClosures from './fixtures/KeyClosures.svelte';

test('a key calling a function a default made binds the name it reads, the row s own', () => {
    const keys = [];
    const keyfn = (value) => {
        keys.push(Number(value));
        return value;
    };
    const target = document.body.appendChild(document.createElement('div'));
    mount(KeyClosures, { target, props: { keyfn } });
    flushSync();

    const read = (key) => [...target.querySelectorAll(`[data-k="${key}"]`)].map((one) => one.textContent);

    expect([read('next'), read('braces'), read('rows'), [...new Set(keys)].sort()]).toEqual([['7'], ['7'], ['1', '2'], [1, 2, 7]]);
});
