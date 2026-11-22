// **A comma at the top level of an argument list is not always a separator.**
// Python writes two inside an element: between a lambda's parameters, up to
// its colon, and in the target of a generator's `for`, up to its `in`. The
// split read every one as the end of an argument, so
// `{@render item(lambda x, y: x + y)}` was refused on `(lambda x)`, and a
// snippet parameter whose default was such a lambda was cut in two.
//
// The number of arguments in each row is CPython's, measured with
// `ast.parse("item(…)", mode="eval").body.args`, and a parameter list's with
// `def item(…): pass`.
import { test, expect, describe } from 'vitest';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import { mount, flushSync } from './mounted.js';
import RenderLambda from './fixtures/RenderLambda.svelte';

// The engine, whose parser the pass reads expressions with.
import '../src/lib/compile.js';

const rewrite = (markup) => pythonExpressions(markup, collector([]));

describe('the arguments of a {@render} are the ones Python reads', () => {
    test.for([
        ['lambda x: x + 2', 1],
        ['lambda x, y: x + y', 1],
        ['(lambda x, y: x + y)', 1],
        ['lambda x, y=2: x + y', 1],
        ['lambda x: lambda y, z: x + y + z', 1],
        ['lambda x, y: x + y, 4', 2],
        ['lambda x=lambda: 1, y=2: x', 1],
        ['x for x, y in pairs', 1],
        ['x for x, y in pairs if x for z, w in y', 1],
        ['"a, b", lambda s, t: s', 2],
        // A name that holds a keyword is no keyword.
        ['info, format', 2],
        ['lambda_, for_, in_', 3]
    ])('item(%s): %i', ([written, count]) => {
        // The arguments, after the snippet and the markup's own: the callee is
        // read by a function of its own, which is no argument.
        const call = rewrite(`{@render item(${written})}`).match(/\[[^\]]*\]\)\((.*)\)\}$/)[1];

        expect(call.match(/__brycomp_expr_py_\d+\(\)/g)).toHaveLength(count);
    });
});

describe('and so are the parameters of a snippet', () => {
    test.for([
        ['callback=lambda x, y: x * y', 1],
        ['first, callback=lambda x, y: x * y', 2]
    ])('item(%s): %i', ([written, count]) => {
        const header = rewrite(`{#snippet item(${written})}{/snippet}`).match(/^\{#snippet item\(([^)]*)\)\}/)[1];

        expect(header.split(',')).toHaveLength(count);
    });
});

// Run, each lambda answers what CPython answers: `(lambda x, y: x + y)(1, 2)`
// is 3, and `(lambda x, y=2: x * y)(5)` is 10.
test('a callback of two parameters reaches the snippet whole, given or by default', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(RenderLambda, { target });
    flushSync();

    expect(target.querySelector('[data-k="item"]').textContent).toBe('3');
    expect(target.querySelector('[data-k="scaled"]').textContent).toBe('10');
});
