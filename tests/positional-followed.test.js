// An element taken apart by position from a list changed in place kept the
// value it had: `{#await held then [n, items]}` showed the old `n` after
// `model[0] = 2.5`, where `value[0]` and Svelte showed the new one.
import { test, expect } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import PositionalFollowed from './fixtures/PositionalFollowed.svelte';

test('an element unpacked by position follows its list changed in place, in a then and an each', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(PositionalFollowed, { target });
    flushSync();

    const read = () => Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]));

    await settled(() => expect(read()).toHaveProperty('then'));
    expect(read()).toEqual({ then: '1.5:1', each: '1:2' });

    app.mutate();
    flushSync();

    expect(read()).toEqual({ then: '2.5:2', each: '3:2' });
});
