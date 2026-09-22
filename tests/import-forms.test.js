// @vitest-environment node
//
// Build-time code: jsdom has no business here, and its null
// `document.currentScript` would break Brython's bootstrap.
//
// The four shapes of `importjs`, and what the compiler does with a declaration
// that is not the shape it expects. Every branch below was uncovered until this
// file existed — measured on `coverage-final.json`, not guessed.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const script = (src) => compile(src, 'Probe', 'src/Probe.svelte').script;

describe('the four shapes of importjs', () => {
    test('named', () => {
        expect(script('importjs {fly} from "svelte/transition"\n')).toContain(
            'import { fly } from "svelte/transition";'
        );
    });

    // `importjs "./styles.css"` — imported for its effect, nothing bound.
    test('bare, for the side effect alone', () => {
        const out = script('importjs "./app.css"\n');

        expect(out).toContain('import "./app.css";');
        expect(out).not.toContain('{ } from');
    });

    test('renamed', () => {
        const out = script('importjs {fly as glide} from "svelte/transition"\n');

        expect(out).toContain('fly as glide');
        // The local name is the one Python reads.
        expect(out).toContain("bind(__proto, 'glide'");
    });

    test('default', () => {
        expect(script('importjs Card from "./Card.svelte"\n')).toContain(
            'import Card from "./Card.svelte";'
        );
    });

    test('default and named together', () => {
        const out = script('importjs Card, {fly} from "./Card.svelte"\n');

        expect(out).toContain('import Card, { fly } from "./Card.svelte";');
        expect(out).toContain("bind(__proto, 'Card'");
        expect(out).toContain("bind(__proto, 'fly'");
    });
});

describe('a declaration the compiler cannot read', () => {
    // `__all__` is read off the AST, so anything that is not a list of string
    // constants is not an export list — it falls back to the default rather
    // than throwing, since it may simply be a name the module uses for itself.
    test('an __all__ that is not a list falls back', () => {
        const out = compile('__all__ = "load"\n\n\ndef load():\n    pass\n', 'M', 'm.py', {
            plain: true
        }).script;

        expect(out).toContain('export { load };');
    });

    test('and one holding something other than strings keeps the strings', () => {
        const out = compile('__all__ = ["load", 3]\n\n\ndef load():\n    pass\n', 'M', 'm.py', {
            plain: true
        }).script;

        expect(out).toContain('export { load };');
    });

    // `__js__` is a declaration to the compiler, never data, so a value it cannot
    // read is refused: ignored, it imported nothing and the name failed at run
    // time, far from the line that caused it.
    test('a __js__ that is not a mapping is refused, with its line', () => {
        expect(() =>
            compile('__js__ = ["@sveltejs/kit"]\n\n\nx = 1\n', 'M', 'm.py', { plain: true })
        ).toThrow(/`__js__` has to be written out as a dict .* \(m\.py:1\)/);
    });

    // A Python name: the value it holds when the module has run is the last one
    // assigned, and each entry has to be spelled out.
    test('the last __js__ assigned is the one that counts', () => {
        const out = compile('__js__ = {"a": ["one"]}\n__js__ = {"b": ["two"]}\n\nx = 1\n', 'M', 'm.py', {
            plain: true
        }).script;

        expect(out).toContain('import { two } from "b";');
        expect(out).not.toContain('"a"');
    });

    test('and an entry it cannot read is refused rather than dropped', () => {
        expect(() =>
            compile('who = "x"\n__js__ = {"c": [who]}\n', 'M', 'm.py', { plain: true })
        ).toThrow(/`__js__` has to be written out: .* \(m\.py:2\)/);
    });

    test('and one whose values are empty imports nothing', () => {
        const out = compile('__js__ = {"@sveltejs/kit": []}\n\n\nx = 1\n', 'M', 'm.py', {
            plain: true
        }).script;

        expect(out).not.toContain('@sveltejs/kit');
    });

    // The two spellings of the same declaration used to answer the same question
    // differently: `importjs` refused a name JavaScript cannot carry, `__js__`
    // filtered it out and imported nothing, with no error. `__js__` is the form
    // a plain `.py` uses, so it is the one a SvelteKit route reaches for.
    test('a name JavaScript cannot carry is refused in both spellings', () => {
        expect(() => script('importjs {fadé} from "x"\n')).toThrow(/importjs: `fadé` is not a name/);
        expect(() =>
            compile('__js__ = {"x": ["fadé"]}\n\n\ny = 1\n', 'M', 'm.py', { plain: true })
        ).toThrow(/`__js__` names `fadé`, which is not a name \(m\.py:1\)/);
    });

    test('and the ASCII twin of each still imports', () => {
        expect(script('importjs {fade} from "x"\n')).toContain('import { fade } from "x";');
        expect(
            compile('__js__ = {"x": ["fade"]}\n\n\ny = 1\n', 'M', 'm.py', { plain: true }).script
        ).toContain('import { fade } from "x";');
    });
});

describe('the indentation hint', () => {
    // `$B.unindent` hands the source back untouched as soon as one non-blank
    // line already sits at column zero, so Brython then raises on the *first*
    // line instead of the one the author got wrong. The hint names the real one.
    test('names the line that broke the block', () => {
        expect(() => script('    a = 1\n    b = 2\nc = 3\n    d = 4\n')).toThrow(
            /line 3 starts at column zero/
        );
    });

    test('and says nothing when no line is indented at all', () => {
        expect(() => script('a = 1\nb = (\n')).toThrow(/svelthon —/);
        expect(() => script('a = 1\nb = (\n')).not.toThrow(/starts at column zero/);
    });
});
