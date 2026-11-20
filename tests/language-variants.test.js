// **A child a plugin makes another language under a query is handed props for
// the language it is.** The parent read the file under the query on disk and
// converted its props for that file's language: a JavaScript file made Python
// got a plain float without its `currency`, and a Python file made JavaScript
// got a Python object with no `toFixed`. A query that keeps the language is
// read as before (`queried-child.test.js`).
import { test, expect } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import LanguageVariants from './fixtures/LanguageVariants.svelte';

test('a child made another language under a query is handed props for that language', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(LanguageVariants, { target });

    flushSync();

    expect(Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent.trim()]))).toEqual({
        'to-python': 'Price|EUR',
        'to-native': 'number|1.25',
        kept: 'Price|EUR'
    });

    await unmount(instance);
    target.remove();
});
