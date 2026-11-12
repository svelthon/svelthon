// **An unquoted value is a value, whatever it spells**, as Svelte reads it.
// Copied among the tag's attribute names, `title=is` made a button a custom
// element, whose truth attributes were handed Python's list as it is, so `[]`
// disabled and hid it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import UnquotedWords from './fixtures/UnquotedWords.svelte';
import UnquotedWordsNative from './fixtures/UnquotedWordsNative.svelte';

test.for([
    ['Python', UnquotedWords],
    ['Svelte', UnquotedWordsNative]
])('%s: a value spelled is or checked is no attribute of that name', ([, Component]) => {
    const states = [[], [1]].map((held) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target, props: { held } });
        flushSync();

        const button = target.querySelector('button');

        return [button.disabled, button.hidden, target.querySelector('input').checked];
    });

    expect(states).toEqual([
        [false, false, true],
        [true, true, true]
    ]);
});
