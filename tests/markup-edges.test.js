import { test, expect, describe } from 'vitest';
import { pythonExpressions, collector } from '../src/lib/markup.js';

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

        expect(out).toContain('{#each __expr_0()}');
        expect(defs[0]).toContain('__seq(items)');
    });

    // `as (k, v)` destructures a tuple, which is what `.items()` hands over.
    test('destructuring a tuple', () => {
        const { out } = rewrite('{#each d.items() as (k, v)}<li>{k}</li>{/each}');

        expect(out).toContain('as [k, v]');
    });

    test('and keeping Svelte s item and index', () => {
        const { out } = rewrite('{#each xs as x, i}<li>{x}</li>{/each}');

        expect(out).toContain('as x, i');
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

        expect(out).toContain('{@attach __event(__expr_0())}');
        expect(defs[0]).toContain('return mark');
    });
});

describe('what the walker refuses to touch', () => {
    // An unclosed brace is not an expression: it is left exactly as typed, and
    // Svelte reports it in its own words.
    test('an unclosed brace crosses unchanged', () => {
        expect(rewrite('<p>{oops</p>').out).toBe('<p>{oops</p>');
    });

    // An apostrophe inside an HTML comment used to open a string that never
    // closed, leaving the whole rest of the template in JavaScript, silently.
    test('and a comment holding an apostrophe does not open a string', () => {
        const { out } = rewrite("<!-- aujourd'hui -->{count}");

        expect(out).toContain('__expr_0()');
    });

    test('nor does one inside a quoted attribute value', () => {
        const { defs } = rewrite('<p class="badge {label.lower()}">x</p>');

        expect(defs[0]).toContain('__text(label.lower())');
    });
});
