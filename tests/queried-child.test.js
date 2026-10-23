// **A Python child imported under a query is still a Python child.** Vite
// makes `./Child.svelte?variant=one` a module of its own, whose component
// announced the one without the query, and the parent's reading of its imports
// took the path for no `.svelte` file: the child was taken for a JavaScript
// one, and the `Price` reached it a plain float without its `currency`. The
// witness is the same child imported as it is (`held-provenance.test.js`).
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import QueriedChild from './fixtures/QueriedChild.svelte';

test.for([['importjs'], ['module'], ['reexport']])('a Python child imported under a query, by %s, keeps the Price it is handed', ([mode]) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(QueriedChild, { target, props: { mode } });
    flushSync();

    expect(target.textContent.trim()).toBe('Price|EUR');
});
