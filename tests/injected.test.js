import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { createRequire } from 'node:module';
import Shadowed from './fixtures/Shadowed.svelte';

const require = createRequire(import.meta.url);
const { INJECTED } = require('../src/lib/injected.cjs');
const { compile } = require('../src/lib/compile.cjs');

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

    for (const { name } of INJECTED.filter((one) => !one.locked)) {
        test(`the author's own ${name} wins`, () => {
            expect(read(name)).toBe(`mine ${name}`);
        });
    }
});

// The other half of the table, and the opposite rule. These are not builtins to
// shadow, they are Svelthon's own words: a component that redefines one is
// refused, with the name in the message, rather than quietly given to either
// side. Svelte draws the same line by reserving the `$` prefix.
describe('a name the compiler keeps for itself', () => {
    const script = (src, options) => compile(src, 'Probe', 'src/Probe.svelte', options);

    for (const { name, component } of INJECTED.filter((one) => one.locked)) {
        test(`redefining ${name} is refused`, () => {
            expect(() => script(`${name} = "mine"\n`)).toThrow(
                new RegExp(`\`${name}\`.+cannot be redefined`)
            );
        });

        // `export` is the one word of this table that JavaScript reserves too,
        // so a plain module refuses it as well: for the other reason, with the
        // other message, and the case below says which. What is under test here
        // is the vocabulary rule, and a word that carries two is a bad witness
        // for either.
        if (component && name !== 'export') {
            test(`but ${name} is free in a plain module`, () => {
                expect(() => script(`${name} = "mine"\n`, { plain: true })).not.toThrow();
            });
        }
    }

    test('`export` in a plain module is refused as JavaScript’s word, not as ours', () => {
        expect(() => script('export = "mine"\n', { plain: true })).toThrow(
            /reserved word in JavaScript/
        );
    });

    test('and the message says what may still be shadowed', () => {
        expect(() => script('effect = 1\n')).toThrow(/date.+may still be shadowed/s);
    });
});
