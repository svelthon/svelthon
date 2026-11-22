// A walrus through a receiver in a handler follows Python's `=`, which
// evaluates the value first, then the receiver, then the key: written as a
// call with the value last, `(target().label := value())` called `target`
// first, and `(holder()[key()] := value())` `holder` and `key` before it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import WalrusOrder from './fixtures/WalrusOrder.svelte';

test('a walrus through a receiver evaluates its value first, as an assignment does', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(WalrusOrder, { target });
    const seen = [];

    for (const k of ['attr', 'item']) {
        target.querySelector(`[data-k="${k}"]`).click();
        flushSync();
        seen.push(instance.seen());
    }

    expect(seen).toEqual(['value,target', 'value,holder,key']);
});
