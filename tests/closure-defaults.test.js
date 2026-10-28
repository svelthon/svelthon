// **A function a default makes reads a later name once it is bound**: the
// read of a name an element after a default binds raised at every read, so
// `[saved=lambda: later, later=7]` raised `Cannot access 'later' before
// initialization` when `saved()` was called, where JavaScript and Python give
// `7`. Read while the default is taken, it still raises
// (`pattern-scope.test.js`).
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ClosureDefaults from './fixtures/ClosureDefaults.svelte';

test('a function a default makes reads a name an element after it binds, once it is bound', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ClosureDefaults, { target, props: { given: [undefined, 7] } });
    flushSync();

    expect(Object.fromEntries([...target.querySelectorAll('output')].map((one) => [one.dataset.k, one.textContent]))).toEqual({
        'snippet-both': '7:7',
        'snippet-given': '7:7',
        'each-both': '7:7',
        'each-given': '7:7'
    });
});
