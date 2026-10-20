// @vitest-environment node
//
// The READMEs hold dozens of blocks of Python and Svelte, and nothing had ever
// run them. `tests/documented-figures.test.js` holds the *numbers* they state,
// written after an outside reading found two that had drifted; this holds the
// *code*, after a reading found seven blocks that did not compile — including
// the flagship example, which used a comment notation no part of Svelthon knows,
// and three signs of the dialect that refused a trailing comment.
//
// A block that is an abbreviation says so with an ellipsis. Anything else has to
// compile, because a reader copies the line that explains the feature.
import { test, expect, describe } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { compile } from '../src/lib/compile.js';

const read = (name) => readFileSync(fileURLToPath(new URL(`../${name}`, import.meta.url)), 'utf8');

// ```python and ```svelte, with their language and their body.
const BLOCKS = /```(python|svelte)\n([\s\S]*?)```/g;

// An ellipsis is the page saying "and the rest": those blocks are fragments on
// purpose and are not compiled.
const ABBREVIATED = /^\s*(\.\.\.|…)\s*$/m;

const blocks = (name) =>
    [...read(name).matchAll(BLOCKS)]
        .map(([, language, body], index) => ({ language, body, index }))
        .filter((one) => !ABBREVIATED.test(one.body));

// A `.svelte` block is markup; only the `<script lang="python">` inside it is
// this compiler's business, and a block without one is template alone.
const script = (one) => {
    if (one.language === 'python') return one.body;

    const found = one.body.match(/<script lang="python">([\s\S]*?)<\/script>/);

    return found === null ? null : found[1];
};

describe.each(['README.md', 'README.fr.md'])('%s', (name) => {
    const documented = blocks(name).filter((one) => script(one) !== null);

    test('has blocks to compile at all', () => {
        expect(documented.length).toBeGreaterThan(10);
    });

    test('and every one of them compiles', () => {
        const refused = [];

        for (const one of documented) {
            try {
                compile(script(one), 'Doc', `${name}#${one.index}`);
            } catch (error) {
                refused.push(`#${one.index} ${error.message.split('\n')[0]}`);
            }
        }

        expect(refused).toEqual([]);
    });
});
