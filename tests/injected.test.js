import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import { createRequire } from 'node:module';
import Shadowed from './fixtures/Shadowed.svelte';

const require = createRequire(import.meta.url);
const { INJECTED } = require('../src/lib/injected.cjs');

// One test per name the compiler publishes, taken from the table itself
// rather than written out here. A name added to it without a line in the fixture
// fails immediately, which is the point: the guarantee is that *every*
// injection steps aside, not that the two or three anyone thought to check do.
describe('a module-level name the compiler also wants', () => {
    const read = (key) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Shadowed, { target });
        flushSync();

        const found = target.querySelector(`p[data-k="${key}"]`);
        if (!found) throw new Error(`${key} is injected but tests/fixtures/Shadowed.svelte never declares it`);

        return found.textContent;
    };

    // `export` is the exception, and it is not one of ours: it is a JavaScript
    // reserved word, so the compiler refuses it as a module-level name long
    // before the injection is bound — a generated `let export = …` would not
    // parse. An author cannot hold that name in a component whatever we do,
    // which is why the injection is free to keep it.
    const RESERVED = new Set(['export']);

    for (const { name } of INJECTED.filter((one) => !RESERVED.has(one.name))) {
        test(`the author's own ${name} wins`, () => {
            expect(read(name)).toBe(`mine ${name}`);
        });
    }

    test('and a JavaScript reserved word cannot be held at all', () => {
        expect(read('export')).toBe('<JavascriptFunction object>');
    });
});
