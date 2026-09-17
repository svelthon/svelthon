// Where a name ends, just before the parenthesis of a call.
//
// The walrus rewrite has to tell a *grouping* parenthesis from a *call's*: only
// the first may be rewritten, because `f(x := 1)` becoming `f__assign("x", 1)`
// calls a name that does not exist. The test read the character before it with
// `\w`, which does not know `é`, so `café(x := 1)` was taken for a grouping and
// the handler was rewritten into `café__assign("x", 1)` — an error event at the
// click and a page that never changed.
//
// The same file already builds its `NAME` pattern from Unicode classes; this
// decision did not use it. The witness is `cafe`, one character apart.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import AccentedWalrus from './fixtures/AccentedWalrus.svelte';

describe.for([
    ['an accented name', 'accented'],
    ['an ASCII name', 'plain']
])('a call to %s holding a walrus', ([, key]) => {
    test('runs, and without an error event', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(AccentedWalrus, { target });
        flushSync();

        let failure;
        const catcher = (event) => {
            failure = event.error ? event.error.message : event.message;
            event.preventDefault();
        };

        const read = () => target.querySelector(`[data-k="${key}-result"]`).textContent;

        expect(read()).toBe('0');

        window.addEventListener('error', catcher);
        target.querySelector(`button[data-k="${key}"]`).click();
        flushSync();
        window.removeEventListener('error', catcher);

        expect(failure).toBeUndefined();
        expect(read()).toBe('2');
    });
});
