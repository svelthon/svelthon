// **A comment or a line continuation in a handler's walrus is blank to it**,
// as Python reads one between any two tokens: between the name and its `:=`,
// one hid the walrus, which was then refused as written outside a handler;
// after the value, one took the parenthesis the rewrite closed with,
// `__assign("count", 7 # note)`, and the component did not compile. A `#`
// inside a string is the string's.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CommentedWalrus from './fixtures/CommentedWalrus.svelte';

test('a handler walrus a comment or a continuation runs through writes the component', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(CommentedWalrus, { target });
    flushSync();

    const seen = [target.querySelector('output').textContent];

    for (const key of ['leading', 'between', 'joined', 'trailing', 'nested', 'string']) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        seen.push(target.querySelector('output').textContent);
    }

    expect(seen).toEqual(['0', '1', '2', '3', '4', '5', '7']);
});
