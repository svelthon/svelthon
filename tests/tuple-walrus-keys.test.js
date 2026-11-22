// **A template `:=` writes under the one tuple key Python reads**, `grid[1, 2]`
// being `grid[(1, 2)]` and `grid[*keys]` being `grid[(*keys,)]`: the key went
// into `__brycomp_setitem(grid, 1, 2, "after")` bare, two arguments where there is one,
// and wrote `2` under `1` without a word; `grid[1,]` made `1,,` and did not
// compile.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TupleWalrusKeys from './fixtures/TupleWalrusKeys.svelte';

const KEYS = ['pair', 'spaced', 'named', 'triple', 'lined', 'nested', 'single', 'trailing', 'starred', 'alone', 'empty', 'tail'];

test('a template walrus writes under the tuple key its brackets spell, and nowhere else', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(TupleWalrusKeys, { target });
    flushSync();

    const read = () => target.querySelector('output').textContent.split('|');
    const seen = [read()];

    for (const key of KEYS) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        seen.push(read());
    }

    expect(seen).toEqual(
        Array.from({ length: KEYS.length + 1 }, (_, done) =>
            KEYS.map((_, at) => `${at < done ? 'after' : 'before'},sentinel,2`)
        )
    );
});
