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
// The parser a binding's target is read with, which the plugin has loaded
// before any markup is read.
import '../src/lib/compile.cjs';

const ROW =
    '<li class="row" data-id="{item.id}" title="{item.title}" ' +
    'onclick={lambda: pick(item)} bind:value={item.label}>{item.label}</li>\n' +
    '<input type="checkbox" value={item.id} bind:group={picked} />\n' +
    '<p>plain text between the rows, as a page has</p>\n';

test('a large template is rewritten in linear time', () => {
    const rewritten = (n) => {
        const markup = `{#each items as item}\n${ROW.repeat(n)}{/each}`;

        return timed(() => pythonExpressions(markup, collector([])));
    };

    expect(growth(rewritten, { from: 100, until: 200 })).toBeLessThan(8);
});
