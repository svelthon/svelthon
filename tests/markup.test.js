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
    test.for([
        ['lambda: (count := count + 1)', true],
        ['lambda: (a := 1, b := 2)', true],
        ['f(x := 1)', false],
        ['"(quoted := no)"', false],
        ["'(also := no)'", false],
        ['count + 1', false]
    ])('%s', ([source, rewritten]) => {
        const out = walrus(source);

        expect(out === source).toBe(!rewritten);
    });

    test('an escaped quote does not end the string', () => {
        const source = '"a \\" (x := 1)"';

        expect(walrus(source)).toBe(source);
    });
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

    test('the transform is told where its chunk starts', () => {
        const offsets = [];
        overMarkup(component, (part, offset) => {
            offsets.push(offset);
            return part;
        });

        for (const offset of offsets) expect(component.slice(offset)).toMatch(/^[\s\S]/);
        expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
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

        expect(out).toContain('__expr_0()');
        expect(defs[0]).toContain('return count');
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
