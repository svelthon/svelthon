// **A row Python iterates is taken apart by position as Python unpacks it,
// wherever the pattern stands**: an `{#each}` and a `then` handed Svelte a
// JavaScript pattern, which asked a `range`, a generator, an iterator or an
// instance's own iteration for JavaScript's protocol, and found nothing, or
// raised; and a key of the index alone took the row apart all the same, so a
// generator was spent before its block read it.
import { test, expect } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import PositionalRows from './fixtures/PositionalRows.svelte';

test('a row Python iterates is taken apart by position, in an each, a keyed each, a then and inside braces', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(PositionalRows, { target });
    flushSync();

    const read = () => Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]));

    await settled(() => expect(read()).toHaveProperty('clause-grouped'));

    expect(read()).toEqual({
        'each-range': '10:20',
        'each-generator': '10:20',
        'each-iterator': '10:20',
        'each-instance': '10:20',
        'keyed-0': '10:20',
        'keyed-1': '30:40',
        'starred-0': '10:20',
        'starred-1': '30:40',
        nested: '10:20',
        then: '10:20',
        // In parentheses too, as an `{#each}` takes them: Python's tuple,
        // where Svelte refused the pattern in its own words.
        'then-tuple': '10:20',
        'clause-tuple': '10:20',
        // And parentheses with no comma inside group, as Python reads them:
        // `(((a, b)))` is `(a, b)`, and `(a)` is `a` (SOL367).
        'clause-grouped': '10:20',
        'each-grouped': '10:20',
        'each-names-grouped': '10:20'
    });
});
