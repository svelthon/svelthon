import { test, expect, describe } from 'vitest';
import { mount, flushSync, rendered } from './mounted.js';
import Passed from './fixtures/Passed.svelte';

// Two constructs kept their text through every earlier pass, and nobody noticed
// because both work as long as the expression happens to be valid JavaScript
// that resolves to a generated `const`. `len(items)` resolves to nothing and
// `items[1:]` does not even parse.
describe('the constructs that used to keep their JavaScript', () => {
    const setup = async () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Passed, { target });
        flushSync();

        const read = (k) => target.querySelector(`[data-k="${k}"]`)?.textContent;

        await rendered(read, 'await', 'inline', 'caught');

        return read;
    };

    test('what an {#await} awaits is Python', async () => {
        expect((await setup())('await')).toBe('got 3');
    });

    test('including an expression JavaScript cannot parse', async () => {
        expect((await setup())('inline')).toBe("got ['b', 'c']");
    });

    test('and a rejection still reaches {:catch}', async () => {
        expect((await setup())('caught')).toBe('ValueError');
    });

    test('what a {@render} gives a snippet is Python', async () => {
        expect((await setup())('snippet')).toBe('b, c/3');
    });
});
