// @vitest-environment node
//
// The five scanners of `markup.js`, reached through the door rather than by
// exporting them.
//
// `closingBrace`, `closingPair`, `atTopLevel`, `walrusTarget` and `trailingKey`
// are private, and their string-and-escape branches were the only code in the
// project that was genuinely untested rather than merely invisible to a coverage
// tool that instruments the test worker.
//
// The temptation was to export them. That is the wrong answer, and naming it is
// worth as much as the tests: **"testable" does not mean "reachable from outside
// the module", it means "reachable by an input"**. What is exported is the API
// the project promises not to break; what is tested is the behaviour it promises
// not to break. Two promises, two audiences.
//
// Every case below is a string a component may hold, and each one is written so
// that the scanner's escape or quote branch is the *only* thing standing between
// it and a wrong answer.
import { test, expect, describe } from 'vitest';

import { collector, pythonExpressions, walrus } from '../src/lib/markup.js';

// The engine, whose parser tells where an `{#await}` expression ends, as the
// plugin loads it before any markup is read.
import '../src/lib/compile.js';

const rewrite = (markup) => pythonExpressions(markup, collector([]));

// A brace that closes the expression, and one that only looks like it.
describe('closingBrace reads through a string', () => {
    // Python `f("a}b")`: the `}` is inside a literal. Taken for the end of the
    // expression, the compiled call stops mid-string and the rest of the line
    // leaks into the markup as text.
    test('a closing brace inside a string does not end the expression', () => {
        expect(rewrite('<p>{f("a}b")}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    // The same, behind an escaped quote: `f("a\"}b")`. Without the escape
    // branch the `\"` reads as the end of the string and the `}` ends the
    // expression one character later.
    test('and neither does one behind an escaped quote', () => {
        expect(rewrite('<p>{f("a\\"}b")}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    test('a brace nested in a dict literal is counted, not skipped', () => {
        expect(rewrite('<p>{ {"k": 1}["k"] }</p>')).toBe('<p>{__expr_0()}</p>');
    });
});

// The bracket that closes a call or a subscript, for `{@render}` and the walrus.
describe('closingPair reads through a string', () => {
    // One argument, which calls nothing, so read inside a getter.
    test('a parenthesis inside a snippet argument stays inside it', () => {
        expect(rewrite('{@render row("a)b")}')).toBe(
            '{@render __pybridge.snippet(__expr_py_0(), [])(({ get value() { return __expr_py_1(); } }).value)}'
        );
    });

    test('and an escaped quote does not end that string early', () => {
        expect(rewrite('{@render row("a\\")b")}')).toBe(
            '{@render __pybridge.snippet(__expr_py_0(), [])(({ get value() { return __expr_py_1(); } }).value)}'
        );
    });
});

// Where an expression ends, for the `then` of an await block.
describe('atTopLevel reads through a string', () => {
    // `{#await f(" then ")}` holds the word inside a literal. Split there, the
    // block awaits half a call and declares a name out of the other half.
    test('the word then inside a string is not the clause', () => {
        expect(rewrite('{#await f(" then ")}x{/await}')).toBe('{#await __expr_py_0()}x{/await}');
    });

    test('while the real clause still splits', () => {
        expect(rewrite('{#await f() then row}x{/await}')).toBe(
            '{#await __expr_py_0() then row}x{/await}'
        );
    });
});

// What a walrus aims at: a name, an attribute, or a key.
describe('walrusTarget reads through a string', () => {
    test('a key holding a bracket is one key, not two', () => {
        expect(walrus('(d["a]b"] := 1)')).toBe('__setitem(d, "a]b", 1)');
    });

    test('and a key holding an escaped quote is still one key', () => {
        expect(walrus('(d["a\\"]b"] := 1)')).toBe('__setitem(d, "a\\"]b", 1)');
    });

    // A slice is a target Python assigns to, and a key spelt as Python spells it
    // as an expression, `slice(start, stop)`; three colons, which no slice
    // holds, are left for Python to report.
    test('a slice is written as the key Python spells it', () => {
        expect([walrus('(d[1:] := 1)'), walrus('(d[1:2:3:4] := 1)')]).toEqual(['__setitem(d, __slice(1, None), 1)', '(d[1:2:3:4] := 1)']);
    });
});

// The key that trails an `{#each}` target, found by balance rather than by
// content. It exists because the regex before it failed silently on a call or a
// tuple key, and the fixtures cover those two shapes.
describe('trailingKey reads through a string', () => {
    const each = (line) => rewrite(`{#each ${line}}x{/each}`);

    // What the block becomes: the rows a walk declared beside it hands over
    // (`__collection`), and the key, when there is one, read with the row and
    // its index.
    const walked = (target, key) =>
        key === undefined
            ? `{const __rows_1 = __collection(() => __expr_py_0())}{#each __rows_1() as ${target}}x{/each}`
            : `{const __rows_1 = __collection(() => __expr_py_0(), (${target}, __index_1) => ${key})}` +
              `{#each __rows_1() as ${target}, __index_1 (__rows_1.noted(__index_1, ${key}))}x{/each}`;

    // The key is compiled like any other expression, so what proves the scanner
    // found the *whole* group is that the target ends where it should: one
    // expression for the rows, one for the key, and nothing left over.
    test('a key holding a parenthesis inside a string is one key', () => {
        expect(each('rows as row ("a)b")')).toBe(walked('row', '__expr_1()'));
    });

    test('and one behind an escaped quote too', () => {
        expect(each('rows as row ("a\\")b")')).toBe(walked('row', '__expr_1()'));
    });

    // Python's strings, read as `atomic` reads them: a field that reuses its
    // f-string's quote, and a lone quote inside a triple-quoted string. The
    // key's own quote reading ended the string early in both, and the key was
    // left in the markup as Python for Svelte to read as JavaScript.
    test.for([
        ['an f-string whose field reuses its quote', 'rows as row (f"{"("}{row.id}")'],
        ['a triple-quoted string holding a lone quote', 'rows as row ("""an "(" quote""" + str(row.id))']
    ])('%s is one key', ([, line]) => {
        expect(each(line)).toBe(walked('row', '__expr_1(row)'));
    });

    // The three shapes that are *not* a key, each for its own reason.
    test('a tuple target is a target, not a key with nothing before it', () => {
        expect(each('pairs as (name, count)')).toBe(walked('[name, count]'));
    });

    // A tuple target *followed by an index*: the parentheses are the target's,
    // and only "is there anything after the group" tells them from a key.
    // Only "is there anything after the group" tells a key from parentheses
    // that belonged to the target. Here `(key)` is followed by an index, so it
    // is not the key and the whole tail crosses untouched.
    test('a group with something after it belonged to the target', () => {
        expect(each('rows as row (key), i')).toBe(walked('row (key), i'));
    });

    test('and an unbalanced line is left for Svelte to report', () => {
        expect(each('rows as row)')).toBe(walked('row)'));
    });
});

// The sixth scanner, and the one the others call: `atomic`, which says how long
// a literal is. An f-string is a grammar inside a string, and this is where the
// project has paid three defects — a backslash before a field, a nested brace,
// a prefix read as the tail of a name.
//
// Every case below was named by the **mutation harness**: each one is a branch
// of that grammar whose flip killed no test, which is to say a decision nothing
// was checking. They are written the way the rest of this file is — a string a
// component may hold — and the assertion is always the same: the expression is
// recognised whole. Cut in half, the template keeps the first half and Svelte is
// handed the rest as markup, which is what a wrong length here does.
describe('atomic reads an f-string as a grammar', () => {
    test('a quote inside a field does not end the string', () => {
        expect(rewrite('<p>{f"{d[\'a\']}"}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    test('and neither does one inside a triple-quoted string', () => {
        expect(rewrite('<p>{f"""{d[\'a\']}"""}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    // The prefix is read backwards from the quote, so `rf` is an f-string and
    // the `f` of a name is not.
    test('a raw f-string is still an f-string', () => {
        expect(rewrite('<p>{rf"{d[\'a\']}"}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    // `:` starts a format specification only at the top of a field and outside
    // brackets. In a slice and in a dict display it is Python's own syntax, and
    // reading it as a specification makes everything after it opaque.
    test('a colon inside a subscript is a slice', () => {
        expect(rewrite('<p>{f"{xs[1:2]}"}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    test('and a colon inside a nested display is a key', () => {
        expect(rewrite('<p>{f"{ {\'a\': 1}[\'a\'] }"}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    // A doubled brace is a literal brace and opens no field, so what follows it
    // is text and not an expression.
    test('a doubled brace is a literal', () => {
        expect(rewrite('<p>{f"{{}}{d[\'a\']}"}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    // And a field *inside* a specification is a field again, which is the one
    // place the rule flips: `{x:>{width}}` is a width read from a name.
    test('a field nested in a specification is a field', () => {
        expect(rewrite('<p>{f"{x:>{w}}"}</p>')).toBe('<p>{__expr_0()}</p>');
    });

    // A comment runs to the end of the line, and a line with no newline after
    // it ends at the end of the source.
    test('a comment with no newline after it ends where the source does', () => {
        expect(walrus('(d["a"] := 1)  # note')).toBe('__setitem(d, "a", 1)  # note');
    });
});
