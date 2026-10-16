// **A name the template declares is the name Python reads, in any spelling
// Python takes for it.** `ﬁle` and `file` are one name to Python, which
// normalizes a name to NFKC, and so they are to every place the template
// declares one: a snippet's parameter, read either way, an `{#each}` item, index
// and key, an `{#await}` value, a template rune, and a snippet rendered inside a
// block.
//
// Each place asked the question its own way, by comparing spellings as written
// at some and through Python's normalization at others, and two audits found a
// place that read a declared name as absent. They are asked in one place now
// (`scopeChain`), and these eight are the forms an audit found answered right.
//
// The witness is CPython: `ﬁle = 3` then `file` is 3, `ｉ = 1` then `i` is 1.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TemplateSpellings from './fixtures/TemplateSpellings.svelte';

test('a name declared in one spelling is read in another Python takes for it', async () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(TemplateSpellings, { target });
    flushSync();
    await new Promise((resolve) => setTimeout(resolve, 0));
    flushSync();

    const shown = Object.fromEntries([...target.querySelectorAll('p')].map((p) => [p.dataset.k, p.textContent.replace(/\s+/g, '')]));

    expect(shown).toEqual({
        snippet: '3',
        'snippet back': '4',
        'each item': '1020',
        'each index': '0011',
        'each key': '1020',
        await: '5',
        rune: '7',
        'nested snippet': '1020'
    });
});
