// @vitest-environment node
//
// The markup pass runs on every save, so its cost has to grow with the template
// and not with the square of it. The rows below carry attributes, interpolated
// values and a handler, which is where the walk reads back what it has written.
//
// Two things make a walk quadratic here, and both read back what was already
// written: a pattern anchored at the end of the whole output, and any slice of
// that output, which is a string built by concatenation and is copied in full
// before it can be sliced. So the attribute patterns read the input instead,
// and the name a `bind:group` takes back out of the output is taken out once,
// at the end, as the lines an expression gives back are.
//
// Measured as it grows (`growth`): four times the rows take about four times as
// long, where a quadratic walk took sixteen. 400 KB of markup took tens of
// seconds on one. From a size that takes a fifth of a second: one slice per
// `bind:group` is cheap enough to pass for linear below it.
import { test, expect } from 'vitest';
import { growth, timed } from './growth.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import { python } from '../src/lib/svelthon.js';
// The parser a binding's target is read with, which the plugin has loaded
// before any markup is read.
import '../src/lib/compile.js';

const ROW =
    '<li class="row" data-id="{item.id}" title="{item.title}" ' +
    'onclick={lambda: pick(item)} bind:value={item.label}>{item.label}</li>\n' +
    '<input type="checkbox" value={item.id} bind:group={picked} />\n' +
    '<p>plain text between the rows, as a page has</p>\n';

test('a large template is rewritten in linear time', () => {
    const rewritten = (n) => {
        const markup = `{#each items as item}\n${ROW.repeat(n)}{/each}`;

        // In the file it stands in, as the preprocessor hands it, so every
        // expression is placed at its line: a line counted on a copy of all
        // that came before it made the walk quadratic in its expressions.
        const where = { filename: 'Rows.svelte', content: markup, offset: 0 };

        return timed(() => pythonExpressions(markup, collector([]), undefined, where));
    };

    expect(growth(rewritten, { from: 100, until: 200 })).toBeLessThan(8);
});

// And the preprocessor's own hook, which the build runs, around the walk: it
// parsed the whole component with Svelte's parser to learn whether it declared
// a custom element, and that parse counts the lines before each expression.
test('the markup hook a build runs grows with the template', () => {
    const pre = python();
    const script = '<script lang="python">\nrows = [1, 2]\nn = 1\n</script>\n';
    const preprocessed = (n) => {
        const blocks = Array.from({ length: n }, (_, i) => `{#each rows as row}{#if row > ${i}}<b>{row + n}</b>{/if}{/each}`);
        const content = script + blocks.join('\n');

        return timed(() => pre.markup({ content, filename: 'Rows.svelte' }));
    };

    expect(growth(preprocessed, { from: 100, until: 200 })).toBeLessThan(8);
});
