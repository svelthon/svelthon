// **A walrus that stands bare in a list or a set of a handler writes the
// component**, as Python's grammar lets it stand there: `walrus` rewrote the
// parenthesised form alone, and `[value := n for n in xs]` reached Python as
// written, refused as a walrus the page runs while it renders, in a handler's
// own lambda.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import WalrusDisplays from './fixtures/WalrusDisplays.svelte';

test('a walrus bare in a list or a set of a handler writes the component', () => {
    const received = [];
    const target = document.body.appendChild(document.createElement('div'));
    mount(WalrusDisplays, { target, props: { sink: (value) => received.push(JSON.stringify(value)) } });
    flushSync();

    const seen = [];

    for (const key of ['list', 'set', 'display']) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        seen.push(target.querySelector('output').textContent);
    }

    expect([received, seen]).toEqual([
        ['[10,20,30]', '[1,2,3]', '[5,6]'],
        ['30:0', '30:3', '5:6']
    ]);
});
