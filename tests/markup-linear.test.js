// @vitest-environment node
//
// The markup pass runs on every save, so its cost has to grow with the template
// and not with the square of it. The rows below carry attributes, interpolated
// values and a handler, which is where the walk reads back what it has written.
//
// Two things make a walk quadratic here, and both read back what was already
// written: a pattern anchored at the end of the whole output, and any slice of
// that output, which is a string built by concatenation and is copied in full
// before it can be sliced. So the attribute patterns read the input instead.
//
// The bound is absolute: 400 KB of markup takes a few hundred milliseconds on a
// linear walk and tens of seconds on a quadratic one.
import { test, expect } from 'vitest';
import { pythonExpressions, collector } from '../src/lib/markup.js';
// The parser a binding's target is read with, which the plugin has loaded
// before any markup is read.
import '../src/lib/compile.cjs';

const ROW =
    '<li class="row" data-id="{item.id}" title="{item.title}" ' +
    'onclick={lambda: pick(item)} bind:value={item.label}>{item.label}</li>\n' +
    '<p>plain text between the rows, as a page has</p>\n';

test('a large template is rewritten in linear time', () => {
    const markup = `{#each items as item}\n${ROW.repeat(2500)}{/each}`;

    expect(markup.length).toBeGreaterThan(400_000);

    const start = performance.now();
    pythonExpressions(markup, collector([]));

    expect(performance.now() - start).toBeLessThan(3_000);
});
