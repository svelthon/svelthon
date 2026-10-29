// **A default that reads a name an element after it binds is taken under a
// token of its own each time**, and leaves that name read again: under one
// token for every row, a second row's default raised in a function the first
// row made, `Cannot access 'later' before initialization`, where JavaScript
// reads `7`; and the name held for the function's sake froze every read of the
// field, `11` where Svelte shows `21`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { capturing } from './default-tokens.js';
import DefaultTokens from './fixtures/DefaultTokens.svelte';

test('each taking of a default has its own token, and the field it reads ahead is read again', () => {
    const { answers, capture } = capturing();
    const source = [undefined, 10];
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(DefaultTokens, { target, props: { capture, source } });
    flushSync();

    const read = (key) => [...target.querySelectorAll(`[data-k="${key}"]`)].map((one) => one.textContent);
    const refreshed = [read('refresh')[0]];

    for (const value of [20, 30]) {
        source[1] = value;
        instance.advance();
        flushSync();
        refreshed.push(read('refresh')[0]);
    }

    expect([read('rows'), read('calls'), answers.map(Number), refreshed]).toEqual([
        ['7:7', '7:7'],
        ['7:7', '7:7'],
        [7, 7, 7],
        ['10', '21', '32']
    ]);
});
