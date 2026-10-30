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
// because the plumbing is the part that broke: the markup, its offset in the
// file, and the filename all have to arrive together.
import { test, expect, describe } from 'vitest';
import { preprocess } from 'svelte/compiler';

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
        ['an unknown tag', '<p>{@nope y}</p>', 4],
        ['Svelte’s {@const}', '<p>{@const y = 2}</p>', 4],
        ['an unknown block', '{#nope x}y{/nope}', 1],
        ['an unknown clause', '{#if x}a{:nope}b{/if}', 9],
        ['a tag in the wrong position', '<p>{@attach f}</p>', 4],
        ['a JavaScript spread', '<p {...x}></p>', 4],
        ['a spread inside a quoted value', '<p title="{**x}">a</p>', 11],
        ['a JavaScript declaration', '{#each rows as row}{const y = row}{/each}', 20],
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
        const content = around('<p>{@nope y}</p>');
        const error = refuse('<p>{@nope y}</p>');

        expect(content[error.start.character]).toBe('{');
    });

    // A `<style>` is made inert text of its own length for the walk, the
    // component's whole and a nested one's body. A shorter one reports a line
    // above the one written, which is worse than saying nothing.
    test.for([
        ['the component’s', '<p>ok</p>\n\n<style>\n  p { color: red }\n</style>\n\n<p>{@nope y}</p>'],
        ['in a loop', '{#each rows as row}\n<style>\n  p { color: red }\n</style>\n\n\n<p>{@nope y}</p>{/each}']
    ])('a refusal after a <style> %s still counts from the top of the file', ([, markup]) => {
        let error;

        try {
            python().markup({
                content: '<script lang="python">\nx = 1\nrows = [1]\n</script>\n\n' + markup + '\n',
                filename: FILE
            });
        } catch (thrown) {
            error = thrown;
        }

        expect(error.start.line).toBe(12);
    });
});

// `:=` writes a name of the component in a handler's `lambda` alone. Anywhere
// else the expression runs while the page renders, and Python bound a name the
// call dropped: `{(x := 1)}` showed 1 and left `x` as it was, in silence.
// Refused there, at its brace. A handler's `lambda`, a temporary handed to a
// call, a name of the expression's own and one of its block bind as they did.
test('a walrus onto a name of the component outside a handler is refused where it was written', async () => {
    const compiled = (markup) => preprocess(around(markup), [python()], { filename: FILE });

    for (const [markup, column] of [
        ['<p>{(x := 1)}</p>', 4],
        ['<p title={(x := 2)}>a</p>', 10],
        ['{#if (x := 1)}a{/if}', 1],
        ['<p>{[(rows := y) for y in [1]]}</p>', 4],
        ['<p>{(lambda: (x := 3))()}</p>', 4]
    ]) {
        const error = await compiled(markup).then(
            () => null,
            (thrown) => thrown
        );

        expect(error?.message).toMatch(/`(x|rows) := …` in the markup writes the component's .* only in a handler's `lambda`/);
        expect(error.message).toContain(`(${FILE}:6:${column})`);
    }

    for (const markup of [
        '<b onclick={lambda: (x := 2)}>x</b>',
        '<p>{print(x := 1)}</p>',
        '<p>{len((y := rows))}</p>',
        '<p>{(lambda x: (x := 3))(1)}</p>',
        '{#each rows as row}<p>{(row := 2)}</p>{/each}'
    ]) {
        await expect(compiled(markup)).resolves.toBeDefined();
    }
});

// Each expression at its own place: the second of two, a line below the first,
// is not the first's; and a walrus inside one that binds a name of the
// expression's own still writes the component's.
test('a walrus is refused in its own expression, and inside a walrus of the expression’s', async () => {
    for (const [markup, at] of [
        ['<p>{x}</p>\n<p>{(x := 1)}</p>', '7:4'],
        ['<p>{(y := (x := 1))}</p>', '6:4']
    ]) {
        const error = await preprocess(around(markup), [python()], { filename: FILE }).then(
            () => null,
            (thrown) => thrown
        );

        expect(error?.message).toContain('`x := …` in the markup writes the component');
        expect(error.message).toContain(`(${FILE}:${at})`);
    }
});

// A Python script Svelte reads as an element of the page, and not as the
// component's, is refused at its line: the markup would stay JavaScript, and its
// first expression only Python can run would fail at run time.
describe('a Python script that is not the component’s', () => {
    test.for([
        ['inside an element', '<div>\n<script lang="python">\nx = 1\n</script>\n</div>'],
        ['inside a block', '{#if shown}\n<script lang="python">\nx = 1\n</script>\n{/if}'],
        ['after a <p> left open', '<p>intro\n<script lang="python">\nx = 1\n</script>']
    ])('%s is refused, with its line', ([, content]) => {
        expect(() => python().markup({ content, filename: FILE })).toThrow(
            `stands inside an element or a block, where Svelte reads it as an element of the page`
        );
        expect(() => python().markup({ content, filename: FILE })).toThrow(`(${FILE}:2)`);
    });

    test('control: a JavaScript component holding none is left alone', () => {
        expect(python().markup({ content: '<div><script>let x = 1;</script></div>', filename: FILE })).toBeUndefined();
    });
});

// The playground compiles a fragment that belongs to no file, and so does
// `pythonRanges`. Nothing forces a caller to know where it is.
describe('and says nothing when there is nothing to name', () => {
    test('a refusal without a file is still a refusal', () => {
        expect(() => pythonExpressions('<p>{@nope y}</p>', collector([]))).toThrow(
            /is not a tag Svelthon knows; the tags are/
        );
    });

    test('with no position glued to it', () => {
        try {
            pythonExpressions('<p>{@nope y}</p>', collector([]));
        } catch (error) {
            expect(error.message).not.toMatch(/\(\S+:\d+:\d+\)/);
            expect(error.filename).toBeUndefined();
        }
    });
});
