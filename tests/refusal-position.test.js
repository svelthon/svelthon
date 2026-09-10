// @vitest-environment node
//
// Where a refusal happened, in the file the author is looking at.
//
// The compiler names a position on all sixteen of its refusals. The markup pass
// named one on none of them, because `pythonExpressions()` never received a
// filename, so a message said what was wrong and left the reader to grep.
// `walk()` was already holding the answer: it keeps `region` on every `{…}` it
// reads, and threw it away one line later.
//
// Asserted through the real preprocessor rather than through `markup.js` alone,
// because the plumbing is the part that broke: the chunk, its offset in the
// file, and the filename all have to arrive together.
import { test, expect, describe } from 'vitest';

import { python } from '../src/lib/svelthon.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';

const FILE = 'src/App.svelte';

// Line 1 is the script tag, so every refusal below sits on line 6, and the
// column is the `{` the author would put the cursor on.
const around = (markup) =>
    `<script lang="python">\nx = 1\nrows = [1]\n</script>\n\n${markup}\n`;

const refuse = (markup) => {
    try {
        python().markup({ content: around(markup), filename: FILE });
    } catch (error) {
        return error;
    }

    throw new Error(`\`${markup}\` was not refused`);
};

describe('a markup refusal names a position', () => {
    const CASES = [
        ['an unknown tag', '<p>{@const y = 2}</p>', 4],
        ['an unknown block', '{#nope x}y{/nope}', 1],
        ['an unknown clause', '{#if x}a{:nope}b{/if}', 9],
        ['a tag in the wrong position', '<p>{@attach f}</p>', 4],
        ['a JavaScript spread', '<p {...x}></p>', 4],
        ['a walrus onto a markup name', '{#each rows as row}<b onclick={(row := 2)}>x</b>{/each}', 31]
    ];

    test.for(CASES)('%s says the file, the line and the column', ([, markup, column]) => {
        const error = refuse(markup);

        expect(error.message).toContain(`(${FILE}:6:${column})`);
    });

    // The sentence is for a terminal; these are for an editor. Svelte's own
    // preprocessor errors carry the same three, which is what lets
    // vite-plugin-svelte put the squiggle under the character.
    test.for(CASES)('%s carries filename and start for a tool', ([, markup, column]) => {
        const error = refuse(markup);

        expect(error.filename).toBe(FILE);
        expect(error.start.line).toBe(6);
        expect(error.start.column).toBe(column - 1);
        expect(error.end.character).toBeGreaterThan(error.start.character);
    });

    test('and the character offset points at the brace itself', () => {
        const content = around('<p>{@const y = 2}</p>');
        const error = refuse('<p>{@const y = 2}</p>');

        expect(content[error.start.character]).toBe('{');
    });

    // A second chunk of markup, after a `<style>`, is walked with an offset of
    // its own. Getting that wrong reports a line from the top of the chunk
    // rather than from the top of the file, which is worse than saying nothing.
    test('a refusal after a <style> block still counts from the top of the file', () => {
        let error;

        try {
            python().markup({
                content:
                    '<script lang="python">\nx = 1\n</script>\n\n<p>ok</p>\n\n' +
                    '<style>\n  p { color: red }\n</style>\n\n<p>{@const y = 2}</p>\n',
                filename: FILE
            });
        } catch (thrown) {
            error = thrown;
        }

        expect(error.start.line).toBe(11);
    });
});

// The playground compiles a fragment that belongs to no file, and so does
// `pythonRanges`. Nothing forces a caller to know where it is.
describe('and says nothing when there is nothing to name', () => {
    test('a refusal without a file is still a refusal', () => {
        expect(() => pythonExpressions('<p>{@const y = 2}</p>', collector([]))).toThrow(
            /is not a tag Svelthon knows; the tags are/
        );
    });

    test('with no position glued to it', () => {
        try {
            pythonExpressions('<p>{@const y = 2}</p>', collector([]));
        } catch (error) {
            expect(error.message).not.toMatch(/\(\S+:\d+:\d+\)/);
            expect(error.filename).toBeUndefined();
        }
    });
});
