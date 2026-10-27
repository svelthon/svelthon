// **A snippet's positional pattern reads its row as JavaScript does**: as far
// as it names positions, a hole being one and what follows a trailing comma
// none, and each element once, a default included. Counted, the empty text
// after `[value,]` read a second element of an iterator, which raised; and a
// default read its element a second time where it was there, so a getter that
// counts answered twice, `42` where Svelte shows `21`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { props, EXPECTED } from './positional-reads-once.js';
import PositionalReadsOnce from './fixtures/PositionalReadsOnce.svelte';

test('a positional pattern reads as far as its positions, and each element once', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(PositionalReadsOnce, { target, props: props() });
    flushSync();

    expect(Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]))).toEqual(
        EXPECTED
    );
});
