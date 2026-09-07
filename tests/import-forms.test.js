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

    test('a __js__ that is not a mapping is ignored', () => {
        expect(() =>
            compile('__js__ = ["@sveltejs/kit"]\n\n\nx = 1\n', 'M', 'm.py', { plain: true })
        ).not.toThrow();
    });

    test('and one whose values are empty imports nothing', () => {
        const out = compile('__js__ = {"@sveltejs/kit": []}\n\n\nx = 1\n', 'M', 'm.py', {
            plain: true
        }).script;

        expect(out).not.toContain('@sveltejs/kit');
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
