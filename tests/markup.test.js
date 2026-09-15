// @vitest-environment node
//
// The markup pass, exercised directly. Every other test reaches it through the
// Vite plugin, which runs in another process — so coverage saw 0 % of its 801
// lines and nothing here was ever measured. These are string in, string out:
// what the preprocessor hands Svelte, before Brython sees any of it.
import { test, expect, describe } from 'vitest';
import {
    walrus,
    overMarkup,
    pythonExpressions,
    pythonRanges,
    moduleImports,
    collector
} from '../src/lib/markup.js';

// `(x := 1)` in a template writes the component's name through the namespace,
// which is what makes it reach the signal. Python's own grammar forces the
// parentheses inside a lambda, and that parenthesised form is the only one
// rewritten — `f(x := 1)` keeps its meaning as a temporary the call consumes.
describe('the walrus', () => {
    // Every form of the grammar, in one table: what is rewritten, what is left
    // alone, and why. Two defects were found here by writing it out — a call's
    // parenthesis taken for a group, and a tuple losing every assignment but the
    // first — so the table is the test rather than a script beside it.
    test.for([
        // The form svelte.dev uses, and the one the documentation shows.
        ['lambda: (count := count + 1)', 'lambda: __assign("count", count + 1)'],

        // Several names at once. Python has no comma operator, so this is a
        // *tuple* whose elements assign — and it stays one. The parentheses are
        // already required for a single assignment, so this form costs the
        // author no new syntax.
        [
            'lambda: (a := 1, b := 2)',
            'lambda: (__assign("a", 1), __assign("b", 2))'
        ],
        [
            'lambda: (a := 1, b := 2, c := 3)',
            'lambda: (__assign("a", 1), __assign("b", 2), __assign("c", 3))'
        ],

        // Only some elements assign; the others cross untouched.
        ['lambda: (x + 1, a := 2)', 'lambda: (x + 1, __assign("a", 2))'],

        ['lambda: (a := (b := 2))', 'lambda: __assign("a", __assign("b", 2))'],
        ['lambda: (x + (y := 2))', 'lambda: (x + __assign("y", 2))'],
        [
            'lambda: ((a := 1) if c else (b := 2))',
            'lambda: (__assign("a", 1) if c else __assign("b", 2))'
        ],
        ['lambda: ((a := 1), f(2))', 'lambda: (__assign("a", 1), f(2))'],

        // The value may hold anything, including what would look like a
        // separator: the split is made at depth zero.
        ['lambda: (a := f(1, 2))', 'lambda: __assign("a", f(1, 2))'],
        ['lambda: (a := (1, 2))', 'lambda: __assign("a", (1, 2))'],

        // A call's own parenthesis belongs to the callee. Consuming it rewrote
        // `f(x := 1)` as `f__assign("x", 1)` — a call to a name that does not
        // exist, so the handler did nothing and said nothing.
        ['f(x := 1)', 'f(x := 1)'],
        ['obj.m(x := 1)', 'obj.m(x := 1)'],
        ['items[0](x := 1)', 'items[0](x := 1)'],

        // Doubling the parentheses is what asks for the assignment.
        ['f((x := 1))', 'f(__assign("x", 1))'],
        ['f(key=(x := 1))', 'f(key=__assign("x", 1))'],
        ['d[(a := 1)]', 'd[__assign("a", 1)]'],
        ['{(a := 1): 2}', '{__assign("a", 1): 2}'],
        [
            'sorted(items, key=lambda i: (n := i))',
            'sorted(items, key=lambda i: __assign("n", i))'
        ],

        // A string is opaque, which is what keeps a template from rewriting
        // text that happens to look like code.
        ['"(quoted := no)"', '"(quoted := no)"'],
        ["'(also := no)'", "'(also := no)'"],
        ['"a \\" (x := 1)"', '"a \\" (x := 1)"'],

        ['lambda: (a == 1)', 'lambda: (a == 1)'],
        ['count + 1', 'count + 1']
    ])('%s', ([source, expected]) => expect(walrus(source)).toBe(expected));

    // Python allows a space between a callee and its parenthesis, so `f (x)` is
    // a call and `not (x)` is not, and the only thing that tells them apart is
    // whether the word is a keyword.
    //
    // This used to read the last character alone, take the space for "nothing
    // callable here", and rewrite `f (x := 1)` into `f __assign("x", 1)`, which
    // is a syntax error on a line the author never wrote. It was recorded here
    // as a known limit, on the grounds that telling the two apart would take a
    // keyword table. It took one regex.
    describe('a call and a group are told apart across a space', () => {
        test.for([
            // A call: the walrus keeps Python's own meaning, a temporary the
            // call consumes, so nothing is rewritten.
            ['f (x := 1)', 'f (x := 1)'],
            ['items[0] (x := 1)', 'items[0] (x := 1)'],
            ['toggle ((open := not open))', 'toggle (__assign("open", not open))'],

            // A keyword cannot be called, so the parenthesis after one is a
            // group whatever the spacing.
            ['not (open := True)', 'not __assign("open", True)'],
            ['a and (x := 1)', 'a and __assign("x", 1)'],
            ['1 if (x := 2) else 0', '1 if __assign("x", 2) else 0'],
            ['return (x := 1)', 'return __assign("x", 1)'],
            ['lambda: (x := 1)', 'lambda: __assign("x", 1)'],

            // And a word that merely ends in a keyword is not one.
            ['isnot (x := 1)', 'isnot (x := 1)'],
            ['obj.for_ (x := 1)', 'obj.for_ (x := 1)']
        ])('%s', ([source, expected]) => expect(walrus(source)).toBe(expected));
    });

    // An f-string is a string, and strings are opaque by design — the rule that
    // protects `"(a := 1)"`. The assignment inside one is therefore lost, which
    // is a question about f-strings rather than about the walrus.
    test('a walrus inside an f-string is not rewritten', () =>
        expect(walrus('f"{(a := 1)}"')).toBe('f"{(a := 1)}"'));
});

// Python is full of braces — dict literals, f-strings — so a `<script>` or a
// `<style>` body must never be walked as markup. Rewriting them would be
// catastrophic, and silently so.
describe('overMarkup walks the markup and nothing else', () => {
    const component = [
        '<script lang="python">',
        'sizes = {"a": 1}',
        'label = f"{sizes}"',
        '</script>',
        '',
        '<p>{label}</p>',
        '',
        '<style>',
        '  p { color: red }',
        '</style>'
    ].join('\n');

    test('a script body is never handed to the transform', () => {
        const seen = [];
        overMarkup(component, (part) => {
            seen.push(part);
            return part;
        });

        expect(seen.join('')).not.toContain('sizes = ');
        expect(seen.join('')).not.toContain('f"{sizes}"');
    });

    test('a style body is not either', () => {
        const seen = [];
        overMarkup(component, (part) => {
            seen.push(part);
            return part;
        });

        expect(seen.join('')).not.toContain('color: red');
    });

    test('the markup is, and the file comes back whole', () => {
        expect(overMarkup(component, (part) => part)).toBe(component);
        expect(overMarkup(component, (part) => part.replace('{label}', 'X'))).toContain('<p>X</p>');
    });

    // HTML allows whitespace before the `>` of a closing tag and Svelte parses
    // it — its own parser fixture is named `whitespace-after-style-tag`. The
    // pattern required the tag to end immediately, so a block closed that way
    // stayed open and its body was walked as markup: the CSS rule below lost its
    // declaration to `{__expr_0()}`, and a Python block closed the same way was
    // never handed to the script hook at all.
    test('a closing tag may hold whitespace before its bracket', () => {
        const spaced = [
            '<script lang="python">',
            'sizes = {"a": 1}',
            '</script >',
            '<p>{label}</p>',
            '<style>p { color: red }</style >'
        ].join('\n');

        const seen = [];
        overMarkup(spaced, (part) => {
            seen.push(part);
            return part;
        });

        expect(seen.join('')).not.toContain('sizes = ');
        expect(seen.join('')).not.toContain('color: red');
        expect(seen.join('')).toContain('{label}');
    });

    test('the transform is told where its chunk starts', () => {
        const offsets = [];
        overMarkup(component, (part, offset) => {
            offsets.push(offset);
            return part;
        });

        // Increasing, and each one lands inside the file: what a caller needs to
        // map a chunk back onto the original rather than only rewrite it.
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
        for (const offset of offsets) expect(offset).toBeLessThanOrEqual(component.length);
        expect(component.slice(offsets[0])).toContain('<p>{label}</p>');
    });
});

// One hidden Python function per distinct expression, appended to the
// component's own source — never prepended, so the author's line numbers stay
// true and error messages keep pointing at the right line.
describe('the collector', () => {
    test('names one function per expression', () => {
        const defs = [];
        const collect = collector(defs);

        expect(collect('count', null, [])).toBe('__expr_0');
        expect(collect('other', null, [])).toBe('__expr_1');
        expect(defs).toHaveLength(2);
    });

    test('the same expression twice is collected once', () => {
        const defs = [];
        const collect = collector(defs);

        expect(collect('count', null, [])).toBe('__expr_0');
        expect(collect('count', null, [])).toBe('__expr_0');
        expect(defs).toHaveLength(1);
    });

    test('a wrapper is part of the identity', () => {
        const defs = [];
        const collect = collector(defs);

        collect('items', null, []);
        collect('items', 'repr', []);

        expect(defs).toHaveLength(2);
        expect(defs[1]).toContain('return repr(items)');
    });

    test('so are the block names in scope', () => {
        const defs = [];
        const collect = collector(defs);

        collect('it', null, []);
        collect('it', null, ['it']);

        expect(defs).toHaveLength(2);
        expect(defs[1]).toContain('def __expr_1(it):');
    });

    // A binding writes back. A module-level name assigned inside a function is
    // local unless declared, so the write would land in a frame nobody reads.
    test('an assignment declares the name it writes', () => {
        const defs = [];
        const collect = collector(defs);

        expect(collect('count', null, [], true)).toBe('__expr_set_0');
        expect(defs[0]).toContain('global count');
    });

    test('but a block’s own name is already a parameter', () => {
        const defs = [];
        collector(defs)('it', null, ['it'], true);

        expect(defs[0]).not.toContain('global');
    });

    test('and a member expression has nothing to declare', () => {
        const defs = [];
        collector(defs)('obj.attr', null, [], true);

        expect(defs[0]).not.toContain('global');
        expect(defs[0]).toContain('obj.attr = ');
    });
});

// What the editor colours. The ranges are the answer the compiler already
// computes, borrowed rather than guessed at a second time.
describe('pythonRanges', () => {
    const component = '<script lang="python">\nname = "x"\n</script>\n\n<p>{name}</p>\n';

    test('finds the expression inside the markup', () => {
        const ranges = pythonRanges(component);

        expect(ranges).toHaveLength(1);
        expect(component.slice(ranges[0].from, ranges[0].to)).toBe('name');
    });

    test('a dict literal in the script is not one of them', () => {
        const withDict = component.replace('name = "x"', 'sizes = {"a": 1}\nname = "x"');

        for (const range of pythonRanges(withDict)) {
            expect(withDict.slice(range.from, range.to)).not.toContain('"a"');
        }
    });

    test('they come back in order', () => {
        const two = component.replace('<p>{name}</p>', '<p>{name}</p><p>{name.upper()}</p>');
        const ranges = pythonRanges(two);

        expect(ranges.map((r) => r.from)).toEqual([...ranges.map((r) => r.from)].sort((a, b) => a - b));
    });

    test('a component with no markup expression has none', () => {
        expect(pythonRanges('<script lang="python">\nname = "x"\n</script>\n<p>plain</p>')).toEqual([]);
    });
});

// Names declared in `<script module>` live in JavaScript. Python cannot import
// them, but they are in scope for the generated code, so they are published into
// the namespace — which means they have to be found first.
describe('moduleImports', () => {
    const withModule = (body) => `<script module>\n${body}\n</script>\n<p>x</p>`;

    test.for([
        ['import Nested from "./Nested.svelte"', ['Nested']],
        ['import { a, b } from "./m.js"', ['a', 'b']],
        ['import { a as b } from "./m.js"', ['b']],
        ['import Default, { a } from "./m.js"', ['Default', 'a']],
        ['import * as all from "./m.js"', ['all']],
        ['import "./side-effect.js"', []]
    ])('%s', ([source, names]) => {
        expect(moduleImports(withModule(source))).toEqual(names);
    });

    test('a component without a module script declares nothing', () => {
        expect(moduleImports('<p>{x}</p>')).toEqual([]);
    });

    test('an instance script is not a module script', () => {
        expect(moduleImports('<script lang="python">\nx = 1\n</script>')).toEqual([]);
    });
});

// The pass itself: every expression the markup reads becomes a call to a hidden
// function, and the block syntax around it survives untouched.
describe('pythonExpressions', () => {
    const rewrite = (markup) => {
        const defs = [];
        const out = pythonExpressions(markup, collector(defs));

        return { out, defs };
    };

    test('an interpolation becomes a call', () => {
        const { out, defs } = rewrite('<p>{count}</p>');

        // `__text` is the wrapper an interpolation gets: Python's str(), so a
        // list renders `['a']` rather than JavaScript's `a`.
        expect(out).toContain('__expr_0()');
        expect(defs[0]).toContain('return __text(count)');
    });

    test('a block keeps its syntax and rewrites only its expression', () => {
        const { out } = rewrite('{#if items}<p>x</p>{/if}');

        expect(out).toMatch(/^\{#if .*\}<p>x<\/p>\{\/if\}$/);
        expect(out).not.toContain('{#if items}');
    });

    test('an {#each} names its row, and the row is in scope below', () => {
        const { out, defs } = rewrite('{#each items as it}<li>{it}</li>{/each}');

        expect(out).toContain(' as it');
        expect(defs.some((one) => one.startsWith('def __expr_1(it):'))).toBe(true);
    });

    test('text around the expressions is left alone', () => {
        const { out } = rewrite('<p>before {x} after</p>');

        expect(out).toContain('before ');
        expect(out).toContain(' after');
    });
});

// The block vocabulary. Each one declares names, holds an expression, or both,
// and the pass has to tell which is which — a name is not compiled, an
// expression is. These were the paths nothing reached.
describe('the blocks that declare names', () => {
    const rewrite = (markup) => {
        const defs = [];
        const out = pythonExpressions(markup, collector(defs));

        return { out, defs };
    };

    // Both names are in scope; each expression takes only the one it reads.
    test('{#each} with an index declares both names', () => {
        const { defs } = rewrite('{#each rows as row, i}<li>{row}{i}</li>{/each}');

        expect(defs.some((one) => /^def __expr_\d+\(row\):/m.test(one))).toBe(true);
        expect(defs.some((one) => /^def __expr_\d+\(i\):/m.test(one))).toBe(true);
        expect(rewrite('{#each rows as row, i}<li>{row * i}</li>{/each}').defs.some(
            (one) => /^def __expr_\d+\(row, i\):/m.test(one)
        )).toBe(true);
    });

    test('{#each} keyed evaluates the key in the row’s scope', () => {
        const { out, defs } = rewrite('{#each rows as row (row.id)}<li>{row}</li>{/each}');

        expect(out).toContain('(__expr_');
        expect(defs.some((one) => one.includes('repr(row.id)'))).toBe(true);
    });

    test('{#await} splits the promise from the name it declares', () => {
        const { out, defs } = rewrite('{#await later() then value}{value}{/await}');

        expect(out).toMatch(/\{#await __expr_\d+\(\) then value\}/);
        expect(defs.some((one) => /^def __expr_\d+\(value\):/m.test(one))).toBe(true);
    });

    // The split is made at depth zero, so a `then` inside the call's own string
    // is not mistaken for the clause.
    test('{#await} is not cut inside its own string', () => {
        const { out } = rewrite('{#await f(" then ")}waiting{/await}');

        expect(out).toMatch(/^\{#await __expr_\d+\(\)\}waiting\{\/await\}$/);
    });

    test('{:then} and {:catch} cross unchanged', () => {
        const { out } = rewrite('{#await p}w{:then value}{value}{:catch failure}{failure}{/await}');

        expect(out).toContain('{:then value}');
        expect(out).toContain('{:catch failure}');
    });

    test('{#snippet} declares its parameters and holds no expression', () => {
        const { out, defs } = rewrite('{#snippet row(item, index)}<li>{item}</li>{/snippet}');

        expect(out).toContain('{#snippet row(item, index)}');

        // Its own name comes first: it lives in the scope that encloses the
        // block, and an enclosing scope reaches into it.
        expect(defs.some((one) => /^def __expr_\d+\(item\):/m.test(one))).toBe(true);
    });

    // `{x = e}` and `{y => e}` are the two signs the script already uses, put in
    // the markup. Svelte spells them `{let x = …}` and `{const y = $derived(…)}`,
    // which are JavaScript keywords in a Python file.
    test('{y => e} declares a derived and compiles its value', () => {
        const { out, defs } = rewrite('{#each rows as row}{half => row / 2}{half}{/each}');

        expect(out).toContain('{const half = $derived(');
        expect(defs.some((one) => one.includes('row / 2'))).toBe(true);
    });

    // `$state.raw` and never `$state`: the latter deep-proxies, and a Brython
    // object behind a JavaScript proxy fails its own type checks. Measured on
    // 5.56.9, one that nothing writes to compiles to a bare binding anyway, so
    // the powerful form costs nothing when the power is unused.
    test('{x = e} declares state, raw', () => {
        const { out } = rewrite('{n = 2}<p>{n}</p>');

        expect(out).toContain('{let n = $state.raw(');
        expect(out).not.toContain('$state(');
    });

    test('and the name it declares enters the scope after it, never before', () => {
        const { defs } = rewrite('{#each rows as row}{half => row / 2}{half}{/each}');

        // The declaration reads the block's name and not its own; the
        // interpolation after it reads the declaration and not the block's.
        expect(defs.some((one) => /^def __expr_\d+\(row\):/m.test(one))).toBe(true);
        expect(defs.some((one) => /^def __expr_\d+\(half\):/m.test(one))).toBe(true);
    });

    // The sign has to be an assignment, not a comparison or a keyword argument.
    test('and a comparison is not a declaration', () => {
        for (const one of ['{a == b}', '{a <= b}', '{a != b}', '{f(a=1)}', '{d["k"]}']) {
            expect(rewrite(one).out, one).not.toContain('$state.raw');
        }
    });

    // A `bind:` on a name the markup declared cannot go through the read/write
    // pair: the generated `def` receives that name as a *parameter*, so the
    // write would land on the parameter and die with the call. Svelte knows how
    // to write those, so the directive is handed over untouched.
    test('a bind: on a markup name is handed to Svelte', () => {
        expect(rewrite('{draft = name}<input bind:value={draft} />').out).toContain(
            'bind:value={draft}'
        );
        expect(rewrite('{value = ""}<input bind:value />').out).toContain('bind:value={value}');
    });

    // Same failure, and it was there before markup declarations existed: an
    // `{#each}` alias is a parameter too.
    test('and so is one on a block s own alias', () => {
        expect(rewrite('{#each xs as row}<input bind:value={row} />{/each}').out).toContain(
            'bind:value={row}'
        );
    });

    test('while a target the script owns keeps the pair', () => {
        const { out } = rewrite('<input bind:value={name} />');

        expect(out).toContain('__expr_set_');
        expect(rewrite('<input bind:value={obj.field} />').out).toContain('__expr_set_');
    });

    // `:=` writes through the namespace, which holds the script's names and
    // nothing else, so a markup name of the same spelling would be written in
    // the wrong scope. Refused rather than sent there.
    test('the walrus refuses a name the markup declared', () => {
        expect(() => rewrite('{open = False}<button onclick={(open := not open)}>x</button>'))
            .toThrow(/declared by the markup/);
    });

    test('and still writes one the script owns', () => {
        expect(rewrite('<button onclick={(open := not open)}>x</button>').out).toContain(
            '__event('
        );
    });

    test('{:else if} compiles its condition through truthy', () => {
        const { defs } = rewrite('{#if a}x{:else if b}y{/if}');

        expect(defs.some((one) => one.includes('__truthy(b)'))).toBe(true);
    });

    test('{:else} alone crosses unchanged', () => {
        expect(rewrite('{#if a}x{:else}y{/if}').out).toContain('{:else}');
    });
});

// `{@render}` takes a call, and each of its arguments is an expression of its
// own — a comma inside one of them is not a separator.
describe('{@render}', () => {
    const rewrite = (markup) => {
        const defs = [];
        return { out: pythonExpressions(markup, collector(defs)), defs };
    };

    test('each argument is compiled separately', () => {
        const { out } = rewrite('{@render row(item, index)}');

        expect(out).toMatch(/\{@render row\(__expr_\d+\(\), __expr_\d+\(\)\)\}/);
    });

    test('a comma inside an argument is not a separator', () => {
        const { out, defs } = rewrite('{@render row(f(a, b))}');

        expect(out).toMatch(/\{@render row\(__expr_\d+\(\)\)\}/);
        expect(defs.some((one) => one.includes('f(a, b)'))).toBe(true);
    });

    test('a snippet rendered without arguments crosses whole', () => {
        expect(rewrite('{@render row()}').out).toBe('{@render row()}');
    });

    // The names it takes are the JavaScript ones the compiler emits, not Python
    // expressions.
    test('{@debug} crosses unchanged', () => {
        expect(rewrite('{@debug count}').out).toBe('{@debug count}');
    });
});

// An attribute is not a text node: what goes in one may be a value rather than
// its rendering, a directive whose name is Python, or a spread. Each shape has
// its own wrapper, and getting them wrong is how JavaScript leaks into a
// template.
describe('the attribute pass', () => {
    const rewrite = (markup) => {
        const defs = [];
        return { out: pythonExpressions(markup, collector(defs)), defs };
    };

    test('an interpolation inside a quoted value', () => {
        const { out, defs } = rewrite('<p class="row {kind}">x</p>');

        expect(out).toMatch(/class="row \{__expr_\d+\(\)\}"/);
        expect(defs[0]).toContain('__text(kind)');
    });

    // The value itself, not its rendering: `data-v={items}` must carry the list.
    test('a bare attribute value keeps the value', () => {
        const { defs } = rewrite('<p data-v={items}>x</p>');

        expect(defs[0]).not.toContain('__text');
    });

    test('class: takes a condition, so it goes through truthy', () => {
        const { defs } = rewrite('<p class:active={current == "a"}>x</p>');

        expect(defs.some((one) => one.includes('__truthy'))).toBe(true);
    });

    // HTML lets an attribute follow a quoted value with no space, and Svelte's
    // parser follows HTML. Five sites decided where a name begins and two read a
    // class that did not exclude the quote, so `title="y"onclick` was the name
    // and matched no rule at all.
    test.for([
        ['a handler', '<b title="y"onclick={go}>x</b>', /onclick=\{__event\(/],
        ['a binding', '<input title="y"bind:value={x}>', /bind:value=\{\(\) =>/],
        ['the shorthand', "<input title='y'bind:value>", /bind:value=\{\(\) =>/],
        ['a class', '<b title="y"class:on={x}>x</b>', /class:on=\{__expr_\d+\(\)\}/]
    ])('%s keeps its rule with no space before it', ([, markup, shape]) => {
        expect(rewrite(markup).out).toMatch(shape);
    });

    test('and let: is still refused there', () => {
        expect(() => rewrite('<b title="y"let:a={x}>x</b>')).toThrow(/Svelte 4 slot syntax/);
    });

    // Svelte accepts `on:click= {foo}`, and its own parser fixture
    // `attribute-with-whitespace` is that line. The attribute was read off what
    // had been written with a pattern anchored at `=`, so a space meant nothing
    // matched: every rule was skipped and the value fell through to the
    // shorthand expansion, which wrote `title= x={…}`. Svelte then answered
    // `Expected token >` about a token the author never typed.
    test.for([
        ['a handler', '<b onclick= {go}>x</b>', /onclick= \{__event\(/],
        ['the colon spelling', '<b on:click= {go}>x</b>', /on:click= \{__event\(/],
        ['a binding', '<input bind:value= {x}>', /bind:value= \{\(\) =>/],
        ['a class', '<b class:on= {x}>x</b>', /class:on= \{__expr_\d+\(\)\}/],
        ['a plain attribute', '<b title= {x}>x</b>', /title= \{__expr_\d+\(\)\}/]
    ])('%s keeps its rule across a space after the =', ([, markup, shape]) => {
        expect(rewrite(markup).out).toMatch(shape);
    });

    // Python's spelling, because Python has one. What comes out is
    // JavaScript's `...`, since that is what Svelte reads.
    test('a spread is written the Python way and compiled as one expression', () => {
        const { out, defs } = rewrite('<div {**attrs}></div>');

        expect(out).toMatch(/\{\.\.\.__expr_\d+\(\)\}/);
        expect(defs[0]).toContain('attrs');
    });

    test('and `...` in that position is refused, naming the Python spelling', () => {
        expect(() => rewrite('<div {...attrs}></div>')).toThrow(/\{\*\*attrs\}/);
        expect(() => rewrite('<div {...attrs}></div>')).toThrow(/Ellipsis/);
    });

    // The other position. A spread fills a tag's attributes, so outside a tag
    // there is nothing for it to spread into, in either spelling. Left to fall
    // through, `{**attrs}` reached Brython as `__text(**attrs)` and the author
    // read a syntax error about a missing comma, on a line they never wrote.
    test.for([['the Python spelling', '**'], ['the JavaScript one', '...']])(
        'a spread outside a tag is refused, in %s',
        ([, marker]) => {
            expect(() => rewrite(`<p>{${marker}attrs}</p>`)).toThrow(/svelthon — /);
            expect(() => rewrite(`<p>{${marker}attrs}</p>`)).toThrow(/\{\*\*attrs\}/);
        }
    );

    test('and the one written with `...` is told about Ellipsis as well', () => {
        expect(() => rewrite('<p>{...attrs}</p>')).toThrow(/Ellipsis/);
        expect(() => rewrite('<p>{**attrs}</p>')).not.toThrow(/Ellipsis/);
    });

    // `...` is refused where a spread would go, and nowhere else: it is a Python
    // object, and it keeps its meaning wherever an expression is read.
    test('`...` stays Python\u2019s Ellipsis in an expression', () => {
        expect(rewrite('<p>{...}</p>').out).toMatch(/\{__expr_\d+\(\)\}/);
        expect(rewrite('<p>{[..., 1]}</p>').defs[0]).toContain('[..., 1]');
    });

    test('a shorthand attribute keeps its name and gains a value', () => {
        expect(rewrite('<input {value} />').out).toMatch(/value=\{__expr_\d+\(\)\}/);
    });

    // Three attribute kinds that are not expressions. Two of them were compiled
    // as if they were, and each failure lands in someone else's compiler with a
    // message about a line the author never wrote.
    //
    // `bind:group` is the same shape as the spread and the accented name: a rule
    // wired into one of two spellings. The long form has refused the pair from
    // the start, for the reason written above `GROUP_DIRECTIVE`, and the
    // shorthand went round it.
    test('bind:group refuses the pair in both spellings', () => {
        const action = /use:__group=\{\[__expr_\d+\(\), \(__value\) => __expr_set_\d+\(pyBind\(__value\)\)\]\}/;

        expect(rewrite('<input bind:group={choix}>').out).toMatch(action);
        expect(rewrite('<input bind:group>').out).toMatch(action);
    });

    // Svelte takes an unquoted attribute value with an interpolation glued onto
    // it. The name was read backwards from the `=` and the value forwards from
    // the `{`, and the text between them went into neither: `red` was swallowed
    // into a name nobody wrote, and Svelte answered `Expected token >` about a
    // token the author never typed. Every quoted spelling was already right.
    test('an unquoted value keeps the text before its interpolation', () => {
        const { out, defs } = rewrite('<div style:color=red{variable}></div>');

        expect(out).toMatch(/style:color=red\{__expr_\d+\(\)\}/);
        expect(out).not.toContain('redvariable');

        // The same wrapper the quoted spelling gets: what is written beside text
        // is text, so Python's `str()` and not JavaScript's.
        expect(defs.join('\n')).toContain('__text(variable)');
    });

    // The tag's own value, which is the only attribute a directive reads beside
    // itself: a DOM value is text, so the action cannot ask the node for it. It
    // is passed on either side of the binding, and only in the braced spelling —
    // a quoted value is text, and the node's own is then exactly right.
    test('and takes the tag value with it', () => {
        const value = /use:__group=\{\[.+, __expr_\d+\(\)\]\}/;

        expect(rewrite('<input bind:group={choix} value={n}>').out).toMatch(value);
        expect(rewrite('<input value={n} bind:group={choix}>').out).toMatch(value);
        expect(rewrite('<input bind:group value={n}>').out).toMatch(value);
        expect(rewrite('<input bind:group={choix} value="a">').out).not.toMatch(value);
    });

    // Svelte reads `<svelte:options>` at compile time and requires literals, so
    // its values are configuration rather than expressions and stay untouched.
    // The quoted spelling always worked, having no braces to catch the eye; the
    // object form of `customElement`, which is how shadow mode and props are
    // configured, came out as `customElement={__expr_0()}` and Svelte answered
    // that it must be a string literal.
    test.for([
        ['<svelte:options runes={False} />'],
        ['<svelte:options customElement={{"tag": "x"}} />'],
        ['<svelte:options namespace="svg" />']
    ])('%s is left alone', ([body]) => {
        expect(rewrite(body).out).toBe(body);
    });

    // Svelte 4 slot syntax, which snippets replaced. Refused rather than passed
    // through, which is this pass's rule for anything it does not handle, and
    // here the rule earns itself: `let:item={row}` compiled to a call and Svelte
    // died inside itself on `Cannot read properties of undefined (reading
    // 'map')`, while `let:item` on its own declared a name no expression of ours
    // can see.
    test.for([['<Card let:item={row}>a</Card>'], ['<Card let:item>a</Card>']])(
        '%s is refused',
        ([body]) => {
            expect(() => rewrite(body)).toThrow(/^svelthon — /);
            expect(() => rewrite(body)).toThrow(/\{#snippet/);
        }
    );

    test('bind: gets a getter and a setter', () => {
        const { out, defs } = rewrite('<input bind:value={name} />');

        expect(out).toContain('() =>');
        expect(defs.some((one) => one.startsWith('def __expr_set_'))).toBe(true);
    });

    test('{@html} renders through Python’s str', () => {
        const { out, defs } = rewrite('{@html markup_text}');

        expect(out).toMatch(/\{@html __expr_\d+\(\)\}/);
        expect(defs[0]).toContain('__text(markup_text)');
    });

    test('a comment is not scanned for expressions', () => {
        expect(rewrite('<!-- {not_an_expression} -->').out).toBe('<!-- {not_an_expression} -->');
    });
});

// A construct left unhandled would cross into the output as JavaScript. The pass
// refuses instead — the rule the project applies everywhere, and the reason five
// leaks were closed at once when the catch-all branches went.
describe('an unknown construct is refused, never passed through', () => {
    const rewrite = (markup) => pythonExpressions(markup, collector([]));

    test.for([
        ['{#nope x}y{/nope}', 'block', 'if, each, key, await, snippet'],
        ['{#if a}x{:nope}y{/if}', 'clause', 'else, then, catch'],
        ['{@nope x}', 'tag', 'html, render, debug']
    ])('an unknown %s', ([markup, kind, known]) => {
        expect(() => rewrite(markup)).toThrow(new RegExp(`is not a ${kind} Svelthon knows`));
        expect(() => rewrite(markup)).toThrow(known);
    });

    test('the message says why it is refused rather than ignored', () => {
        expect(() => rewrite('{@nope x}')).toThrow(/would\s+cross as JavaScript/);
    });

    // Svelte 5 takes `{const a = n}` inside a block, its own spelling of
    // `{@const}`, and Svelthon's answer is the template rune `{a = n}`. The
    // keyword fell through to the generic interpolation, so the author read
    // Brython's `invalid syntax` about `__text(const a = n)`, on a line nobody
    // wrote. The `@`-prefixed form was refused properly all along.
    test.for([
        ['{#each rows as n}{const a = n}{/each}', '{a = n}'],
        ['{#each rows as n}{let total = n * 2}{/each}', '{total = n * 2}'],
        ['{#each rows as n}{var a = n}{/each}', '{a = n}']
    ])('%s is refused and names the Svelthon spelling', ([markup, spelling]) => {
        expect(() => rewrite(markup)).toThrow(/declares with a JavaScript keyword/);
        expect(() => rewrite(markup)).toThrow(spelling);
        expect(() => rewrite(markup)).toThrow(/would\s+cross as JavaScript/);
    });

    // A spread is an attribute of its own. Written as the *value* of a named one
    // it was refused in neither spelling: `title={**x}` reached Brython as an
    // expression and `title="{**x}"` reached it as `__text(**x)`, so the author
    // read a syntax error about a comma. Svelte refuses the bare form itself,
    // with `Unexpected token`, which names nothing they typed.
    test.for([
        ['<div title={**x}></div>'],
        ['<div title="{**x}"></div>'],
        ['<div title={...x}></div>'],
        ['<p>{**x}</p>']
    ])('%s is refused wherever a spread has nothing to fill', ([markup]) => {
        expect(() => rewrite(markup)).toThrow(/a spread fills a tag's attributes/);
        expect(() => rewrite(markup)).toThrow(/<div \{\*\*x\}>/);
    });

    // The attribute is named, because that is the word the author has to remove.
    test('and the refusal names the attribute it was written on', () => {
        expect(() => rewrite('<div title={**x}></div>')).toThrow(/the value of `title`/);
        expect(() => rewrite('<p>{**x}</p>')).toThrow(/nothing for it to spread into/);
    });

    // `...` is Python's Ellipsis, and only `...` run straight into a name is a
    // spread. The three below are expressions an author is entitled to write.
    test.for([
        ['<div title={...}></div>'],
        ['<div title={... if a else b}></div>'],
        ['<div {**x}></div>']
    ])('%s still compiles', ([markup]) => {
        expect(() => rewrite(markup)).not.toThrow();
    });

    // And the rune itself keeps working, which is what the refusal points at.
    test('the Svelthon spelling it names is the one that compiles', () => {
        expect(() => rewrite('{#each rows as n}{a = n}{a}{/each}')).not.toThrow();
        expect(() => rewrite('{#each rows as n}{a => n * 2}{a}{/each}')).not.toThrow();
    });

    // `{@…}` is read in two positions with no overlap between them, and one
    // shared list used to make every one of these refusals name the very word
    // the author had just written.
    test.for([
        ['<p>{@attach fn}</p>', 'attach', 'html, render, debug'],
        ['<div {@html x}></div>', 'html', 'attach'],
        ['<div {@render row()}></div>', 'render', 'attach']
    ])('%s is refused without claiming to know it', ([markup, word, known]) => {
        expect(() => rewrite(markup)).toThrow(/is not a tag Svelthon knows/);
        expect(() => rewrite(markup)).toThrow(`the tags are ${known}`);
        expect(() => rewrite(markup)).not.toThrow(new RegExp(`the tags are[^.]*\\b${word}\\b`));
    });

    // The other side of the same rule: each is accepted where Svelte puts it.
    test.for([['<div {@attach fn}></div>'], ['<p>{@html x}</p>']])(
        '%s compiles',
        ([markup]) => {
            expect(() => rewrite(markup)).not.toThrow();
        }
    );
});
