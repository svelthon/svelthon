import { test, expect, describe } from 'vitest';
import { mount, flushSync, rendered, settled } from './mounted.js';
import AwaitCoroutine from './fixtures/AwaitCoroutine.svelte';
import AwaitShorthand from './fixtures/AwaitShorthand.svelte';

// An `{#await}` over a promise works and is covered elsewhere. This is the case
// a Python author reaches for first: an `async def` in the component, awaited by
// the template.
//
// It rendered `undefined` until the runtime's `schedule()` started handing back
// a promise. It ran the coroutine and returned nothing, so the block awaited
// `undefined` and resolved to it immediately — the wrapper that *does* return a
// promise was wired only to the export boundaries.
describe('an await block over a coroutine', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AwaitCoroutine, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            // Both blocks show `waiting` until their coroutine lands, so that
            // is the condition rather than a guessed delay.
            settle: () => rendered((k) => target.querySelector(`p[data-k="${k}"]`).textContent, 'block', 'failing')
        };
    };

    test('the pending branch shows first', () => {
        expect(setup().read('block')).toBe('waiting');
    });

    test('the then branch gets the value the coroutine returned', async () => {
        const { read, settle } = setup();
        await settle();
        expect(read('block')).toBe('42');
    });

    test('a coroutine that raises lands in the catch branch', async () => {
        const { read, settle } = setup();
        await settle();
        expect(read('failing')).toContain('no answer');
    });
});

// Svelte lets the `then` clause be folded into the opening tag. `BLOCK_NAMES`
// knew `:then` and `:catch` as clauses and had no entry for the shorthand, so
// the name it declares was never put in scope: the expression compiled it as a
// free name and the block rendered empty, while the same await written the long
// way worked. Nothing said a word.
describe('the {#await … then name} shorthand', () => {
    const setup = async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(AwaitShorthand, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

        await rendered(read, 'long');

        return read;
    };

    test('declares its name, like the clause it folds', async () => {
        expect((await setup())('short')).toBe('done');
    });

    test('and the long form still does', async () => {
        expect((await setup())('long')).toBe('done');
    });

    // The promise is evaluated outside the block, so the name is not in scope
    // for it: pushing the scope too early made the awaited expression read a
    // parameter that does not exist yet.
    test('the awaited expression reads the outer scope', async () => {
        expect((await setup())('outer')).toBe('42');
    });

    // With no name after it, as Svelte takes `{#await p then}` and `{#await p
    // catch}`: the word was read as the end of the Python expression, `later()
    // then`, and refused as invalid syntax.
    test.for([
        ['bare', 'resolved'],
        ['caught', 'failed']
    ])('and `%s`, with no name, waits for its branch', async ([key, shown]) => {
        const read = await setup();

        await settled(() => expect(read(key)).toBe(shown));
    });
});
