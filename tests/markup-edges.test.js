import { test, expect, describe } from 'vitest';
import { pythonExpressions, collector } from '../src/lib/markup.js';
// The parser the names an expression reads are read with, which the plugin
// has loaded before any markup is read.
import '../src/lib/compile.js';

// The corners of the markup pass: shapes that are legal Svelte and that the
// walker has to answer for, each of them an uncovered branch until this file
// existed — measured on `coverage-final.json`, not guessed.
const rewrite = (markup) => {
    const defs = [];
    return { out: pythonExpressions(markup, collector(defs)), defs };
};

describe('an {#each} the walker still has to place', () => {
    // No `as`: nothing is declared, and there is no key either. The iterable is
    // still Python, and still goes through `__seq`.
    test('without a name', () => {
        const { out, defs } = rewrite('{#each items}<li>x</li>{/each}');

        expect(out).toContain('{const __rows_1 = __collection(() => __expr_py_0())}{#each __rows_1()}');
        expect(defs[0]).toContain('__seq(items)');
    });

    // `as (k, v)` destructures a tuple, which is what `.items()` hands over: the
    // row taken apart by position, as Python walks it (`unpackPositional`).
    test('destructuring a tuple', () => {
        const { out } = rewrite('{#each d.items() as (k, v)}<li>{k}</li>{/each}');

        expect(out).toContain('as __unpacked_0}{const __unpacked_1 = $derived(__pybridge.positional(__unpacked_0, 2))}');
    });

    test('and keeping Svelte s item and index', () => {
        const { out } = rewrite('{#each xs as x, i}<li>{x}</li>{/each}');

        expect(out).toContain('as x, i');
    });

    // Svelte 5's index without a name for the row, `{#each items, i}`: read as
    // a tuple to walk, it raised `NameError` for `i` at mount. A tuple between
    // parentheses is still one.
    test('and Svelte s index without a name for the row', () => {
        const { out, defs } = rewrite('{#each items, i}<li>{i}</li>{/each}');

        expect(out).toContain('{#each __rows_1(), i}');
        expect([defs[0].includes('__seq(items)'), defs[1].includes('(i)')]).toEqual([true, true]);
        expect(rewrite('{#each (a, b)}<li>x</li>{/each}').defs[0]).toContain('__seq((a, b))');
    });

    // A key that is the index, `(i)`, is Svelte's indexed block, as without
    // one: read as part of the index, `items, i (i)` was a tuple to walk and
    // `i (i)` a call. Any other key needs a row, and Svelte refuses it.
    test('and a key that is its index', () => {
        const plain = rewrite('{#each items, i}<li>{i}</li>{/each}');

        for (const key of ['(i)', '((i))', ' ( i ) ']) {
            expect(rewrite(`{#each items, i ${key}}<li>{i}</li>{/each}`)).toEqual(plain);
        }
        expect(() => rewrite('{#each items, i (i + 1)}<li>{i}</li>{/each}')).toThrow(
            '`{#each items, i (i + 1)}` keys a block that names no row, which Svelte refuses (`each_key_without_as`); ' +
                'name the row, `{#each items as row, i (i + 1)}`'
        );
    });

    // What follows the first comma is the index, a name, as Svelte's parser
    // reads it: `{#each xs, 1}` walked the tuple `(xs, 1)` in silence, where
    // Svelte refuses it.
    test('and an index that is no name refused', () => {
        for (const [body, after] of [['xs, 1', '1'], ['a, b, i', 'b, i']]) {
            expect(() => rewrite(`{#each ${body}}<li>x</li>{/each}`)).toThrow(
                `\`{#each ${body}}\` reads \`${after}\` as the block's index, which is a name, as Svelte's parser ` +
                    `has it (\`expected_identifier\`); a tuple to walk is written between parentheses, \`{#each (${body})}\``
            );
        }
    });

    // Python's order tested membership, walked a boolean and raised `NameError`
    // for the row at mount.
    test('and Python s order refused, with Svelte s', () => {
        expect(() => rewrite('{#each x in xs}<li>{x}</li>{/each}')).toThrow("`{#each x in xs}` is Python's `for` order; Svelte's block is written `{#each xs as x}`");
    });
});

describe('a tag written the short way', () => {
    // `{@render row}` with no call: nothing to compile, and it crosses whole.
    test('a render with no arguments at all', () => {
        expect(rewrite('{#snippet row()}x{/snippet}{@render row}').out).toContain('{@render row}');
    });

    // `{@attach fn}` — the attachment is Python, and what it yields is a
    // callable Svelte will invoke with the node, so it goes through the handler
    // wrapper like any other callable leaving Python.
    test('an attachment', () => {
        const { out, defs } = rewrite('<p {@attach mark}>x</p>');

        expect(out).toContain('{@attach __attach(__expr_0())}');
        expect(defs[0]).toContain('return (mark)');
    });
});

describe('what the walker refuses to touch', () => {
    // An unclosed brace is not an expression. Left as typed, it was Svelte's to
    // report, and Svelte read the rest as JavaScript: `Unterminated regular
    // expression`, which says nothing of the brace.
    test('an unclosed brace is refused as one', () => {
        expect(() => rewrite('<p>{oops</p>')).toThrow(/this `\{` opens an expression that no `\}` closes/);
    });

    // An apostrophe inside an HTML comment used to open a string that never
    // closed, leaving the whole rest of the template in JavaScript, silently.
    test('and a comment holding an apostrophe does not open a string', () => {
        const { out } = rewrite("<!-- aujourd'hui -->{count}");

        expect(out).toContain('__expr_0_memo');
    });

    test('nor does one inside a quoted attribute value', () => {
        const { defs } = rewrite('<p class="badge {label.lower()}">x</p>');

        expect(defs[0]).toContain('__text(label.lower())');
    });
});
