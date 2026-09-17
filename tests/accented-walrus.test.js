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
    ['an ASCII name', 'plain'],
    // The second half, found a pass later: this name ends on an ASCII letter, so
    // the repair above is content, and the four letters before the parenthesis
    // spell `not`. The boundary in front of a keyword was still ASCII, so `é`
    // read as the end of the word before it and `énot(x := 1)` was rewritten
    // into a name that does not exist — the same failure, one predicate over.
    ['a name that ends in a keyword', 'keyword'],
    ['the same name in ASCII', 'ascii_keyword']
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

// And the control on the other side, which is what keeps the repair honest: a
// real keyword cannot be called, so its parenthesis *is* a grouping, and the
// walrus inside it is still rewritten into a write through the namespace.
test('a real keyword before a walrus is still a grouping', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AccentedWalrus, { target });
    flushSync();

    const read = () => target.querySelector('[data-k="x"]').textContent;

    expect(read()).toBe('0');

    target.querySelector('button[data-k="grouped"]').click();
    flushSync();

    expect(read()).toBe('2');
});
