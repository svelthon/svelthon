// @vitest-environment node
//
// The compiler is build-time code: jsdom has no business here, and its null
// `document.currentScript` would break Brython's bootstrap.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

import { overMarkup, pythonExpressions, collector } from '../src/lib/markup.js';
import { compile as compileSvelte } from 'svelte/compiler';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');

// The compiler used to be tested only through mounted components — so only
// along its happy paths. These go through no rendering at all.
describe('compiler', () => {
    test('a Python syntax error is readable', () => {
        // Untreated, a Brython exception arrives with message: undefined and
        // Vite reports nothing whatsoever.
        expect(() => compile('\ncount = 0\n\ndef broken(\n    return count\n', 'S', 'src/S.svelte'))
            .toThrow(/SyntaxError: '\(' was never closed \(src\/S\.svelte:4\)/);
    });

    test('the error names the file’s line, not the script’s', () => {
        expect(() => compile('\nx = )\n', 'S', 'src/S.svelte', { lineOffset: 10 })).toThrow(
            /src\/S\.svelte:12/
        );
    });

    // This test used to say the name *stayed usable without being published*,
    // and the sentence was measured on the generated script alone. Measured on a
    // mounted component instead, on 2026-09-17: `new = 2` renders 2, a handler
    // moves the model to 3, and the page stays at 2 for ever, while `ok` beside
    // it repaints. No error, nothing in the console. A module's `def default()`
    // was dropped from its exports the same way, and a value named in `__all__`
    // was told the module *never binds it*, which was false.
    //
    // So it is refused, which is the rule `injected.cjs` states about its own
    // list: winning in silence is the worst of the three behaviours.
    test('a Python name JavaScript reserves is refused, at its line', () => {
        expect(() => compile('class_ = 1\nnew = 2\nok = 3\n', 'R', 'R.svelte')).toThrow(
            /`new` is a reserved word in JavaScript.+R\.svelte:2/s
        );
    });

    test('and the message names the rename that works', () => {
        expect(() => compile('new = 2\n', 'R', 'R.svelte')).toThrow(/`new_`/);

        // Python's own convention for the collision, and the witness that the
        // advice compiles: `class_` has been in this file since the beginning.
        const { script } = compile('class_ = 1\nnew_ = 2\nok = 3\n', 'R', 'R.svelte');

        expect(script).toContain('let ok = $state.raw');
        expect(script).toContain('let class_ = $state.raw');
        expect(script).toContain('let new_ = $state.raw');
    });

    // The refusal is about a name the generated module would have to bind, so it
    // stops where the bindings stop: inside a `def`, `new` is an ordinary local
    // and JavaScript never sees it.
    test('the same word inside a def is untouched', () => {
        expect(() => compile('def f():\n    new = 2\n    return new\n', 'R', 'R.svelte')).not.toThrow();
    });

    test('every state name gets its revision signal', () => {
        // Two signals per name: the value, and a counter the getter reads — it
        // is the counter that makes an in-place mutation visible without a copy.
        const { script } = compile('items = []\n', 'R', 'R.svelte');

        expect(script).toContain('let __rev_items = $state.raw(0)');
        expect(script).toContain('const __bump_items = () => { __rev_items += 1; }');
        expect(script).toContain("bind(__proto, 'items', () => (__rev_items, items)");
        // The list is the fourth argument, and the `onDestroy` below is what
        // empties it, on the server too: a container reached through a store
        // outlives the instance that read it, so subscribing without a way out
        // accumulates.
        expect(script).toContain('__track(__next, __bump_items, __read_items, __subs)');
        expect(script).toContain('__onDestroy(() => __unsubscribe(__subs));');
    });

    test('a store folds annotations into state and registers itself for Python', () => {
        const { script } = compile('n: int = 0\n', 'S', 'src/lib/shop.py', { store: true });

        expect(script).not.toContain('$props()'); // a store has no parent
        expect(script).toContain('let n = $state.raw');
        expect(script).toContain('__pythonModule(__py, "shop"');
    });

    // Brython scatters `$B.set_lineno(frame, N)` through its output, which is
    // enough to map generated lines back to Python ones. A map that points at
    // the wrong line is worse than no map, so decode it and check.
    test('the source map points at the right Python line', () => {
        const file = `<script lang="python">
count = 0

def increment():
    global count
    count += 1
</script>`;
        const body = file.match(/<script lang="python">([\s\S]*?)<\/script>/)[1];

        const { module, map } = compile(body, 'C', 'src/C.svelte', { sourceContent: file });

        expect(map.sources).toEqual(['src/C.svelte']);
        expect(map.sourcesContent[0]).toBe(file);

        // Minimal VLQ decoding: one segment per generated line, delta-encoded.
        const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let sourceLine = 0;
        const lineFor = map.mappings.split(';').map((segment) => {
            if (!segment) return null;
            let value = 0;
            let shift = 0;
            let index = 2; // skip the generated column and the source index
            for (;;) {
                const digit = CHARS.indexOf(segment[index++]);
                value += (digit & 31) << shift;
                if (!(digit & 32)) break;
                shift += 5;
            }
            sourceLine += value & 1 ? -(value >> 1) : value >> 1;
            return sourceLine;
        });

        // `count += 1` is line 6 of the file; find the generated line carrying
        // its marker and check where the map sends it.
        const generated = module.split('\n').findIndex((l) => /set_lineno\(frame, 6\)/.test(l));

        expect(generated).toBeGreaterThan(0);
        expect(lineFor[generated]).toBe(5); // 0-indexed: line 6 of the file
    });

    // Fixed upstream, `filename-invalid-identifier-chars`, and it was a local
    // edit in the vendored bundle before that. Going upstream does not retire
    // the test: a newer Brython loses a behaviour as silently as a dropped
    // edit, and this is what turns red when it does. See BRYTHON.md.
    test('a path builds a valid identifier, and __file__ keeps the real path', () => {
        const { module } = compile('x = 1\n', 'C', 'src/routes/+page.server.py');

        // Upstream neutralises only '.', so this read `locals_src/routes/…`,
        // which is a SyntaxError — and only when the generated code was run.
        expect(module).toContain('locals_src_routes__page_server_py = $B.namespace(');
        expect(module).not.toMatch(/locals_[\w$]*\//);

        // The point of the patch: a traceback naming the file, not a slug. The
        // literal is written by `JSON.stringify` since a path may hold a quote,
        // which is what `tests/source-path.test.js` is about.
        expect(module).toContain('__file__ = "src/routes/+page.server.py"');
    });

    // Fixed upstream too, `fstring-middle-position`. Brython reported the
    // position of the token that *opened* the f-string for every FSTRING_MIDDLE
    // chunk, so anything walking the stream positionally went backwards and
    // re-emitted text it had already seen. See BRYTHON.md.
    test('an f-string chunk reports its own position', () => {
        const $B = globalThis.__BRYTHON__;
        const FSTRING_MIDDLE = 60;

        const chunks = (src) =>
            [...$B.tokenizer(src, 't.py', 'file')]
                .filter((token) => token.type === FSTRING_MIDDLE)
                .map((token) => src.slice(token.col_offset, token.end_col_offset));

        // The span is the source, so `{{` counts for two characters where the
        // token's own text holds one — which is why this compares slices rather
        // than token strings.
        expect(chunks('seen = f"{len(items)} items"\n')).toEqual([' items']);
        expect(chunks('x = f"a{v}b"\n')).toEqual(['a', 'b']);
        expect(chunks('z = f"""multi {v} line"""\n')).toEqual(['multi ', ' line']);
        expect(chunks('y = f"{{literal}} {v:>5} tail"\n')).toEqual(['{{literal}} ', '>5', ' tail']);
    });

    // The boundary towards JavaScript is laid down at compile time; what it
    // then does is checked in boundary.test.js.
    // This used to read *wrapped once, not on every read*, and asserted the
    // `const __js_error = __jsCall(error);` that carried it. Wrapping once was
    // never the goal: the goal was that a function adapted twice not be two
    // different proxies, and a name is a **binding** — taking its value once
    // meant a `let` in a `<script module>` reached Python as the number it had
    // at build time, for ever.
    //
    // So the read is fresh and the identity is kept where it belongs, in
    // `jsCall`'s own memo. `tests/module-binding.test.js` holds both halves as
    // behaviour; this line only says the binding is read and not captured.
    test('a JavaScript import is read at every access, not captured', () => {
        const { script } = compile(
            '__js__ = {"@sveltejs/kit": ["error"]}\n__all__ = ["load"]\n\ndef load():\n    return {}\n',
            'M',
            'src/routes/+page.server.py',
            { plain: true }
        );

        expect(script).toContain("bind(__proto, 'error', () => __jsCall(error), ");
        expect(script).not.toContain('const __js_error =');
    });

    test('a component imports the pyData that to_py depends on', () => {
        // It was bound without being imported: a ReferenceError on the first
        // read of to_py, and on that one alone.
        const { script } = compile('x = 1\n', 'C', 'src/C.svelte');

        expect(script).toMatch(/import \{[^}]*\bpyData as __pyData\b[^}]*\} from 'svelthon\/runtime'/);
        expect(script).toContain("bind(__proto, 'to_py', () => __pyData");
    });

    // A `from x import y` inside a docstring is documentation, not an import.
    // The list of modules was read off the text as well as off the AST, by a
    // regex anchored per line, so a line inside a triple quote counted: the
    // prelude carried a real `import`, Vite loaded the file, and its module body
    // ran on every mount — for a name that only appears in an example.
    //
    // A comment and a single-quoted string were safe for the same reason this
    // was not: neither puts the word at the start of a line, and a docstring
    // does.
    test('a module named only inside a docstring is not imported', () => {
        const src = [
            'doc = """',
            "Exemple d'usage :",
            '',
            'from effet import quelque_chose',
            '"""',
            '',
            'from compteur import total',
            ''
        ].join('\n');

        const { imports } = compile(src, 'C', 'src/C.svelte');

        expect(imports).toContain('compteur');
        expect(imports).not.toContain('effet');
    });
});

// The property that holds over the two halves at once: whatever a template
// says, the author reads a Svelthon sentence or the component compiles. What
// must never happen is the third outcome, an emission that is not Python, which
// reaches the author as a Brython error about a line they never wrote.
//
// It is written as a matrix of *positions* because that is how it breaks twice
// over: `{@…}` and then a spread were each handled inside a tag and forgotten
// outside one, or the reverse. Every construct is therefore written in both.
describe('a template is refused or it compiles', () => {
    const CONSTRUCTS = [
        '{**attrs}', '{...attrs}', '{@attach fn}', '{@html x}', '{@render row(1)}',
        '{@debug x}', '{name}', '{x = 1}', '{y => 1}', '{...}', '{[..., 1]}',
        '{... if flag else 1}', 'bind:value={name}', 'bind:group={name}', 'bind:group',
        'onclick={go}', 'class:on={flag}', 'use:action={opt}', 'href={url}',
        'let:item={name}', 'let:item'
    ];

    // The ones that are a tag rather than something written in one.
    const WHOLE = [
        '<svelte:options runes={false} />',
        '<svelte:options customElement={{ tag: "my-widget" }} />',
        '<svelte:options namespace="svg" />'
    ];

    const rows = [
        ...CONSTRUCTS.flatMap((one) => [
            [`<div ${one}>a</div>`, `${one}, inside a tag`],
            [`<div>${one}</div>`, `${one}, outside one`]
        ]),
        ...WHOLE.map((one) => [one, one])
    ];

    test.for(rows)('%s', ([body]) => {
        const defs = [];
        let emitted;

        try {
            emitted = overMarkup(body, (markup, at) =>
                pythonExpressions(markup, collector(defs), undefined, at));
        } catch (error) {
            expect(error.message).toMatch(/^svelthon — /);
            return;
        }

        expect(() =>
            compile('attrs = {}\nname = 1\nflag = True\nurl = ""\n', 'Probe', 'Probe.svelte', {
                defs
            })
        ).not.toThrow();

        // The second half of the property, and the one that found three of the
        // four defects above: what we hand Svelte has to be something Svelte
        // takes. A template Svelte itself refuses is not ours to answer for, so
        // it is the input being accepted that puts the output under the rule.
        let accepted = true;
        try {
            compileSvelte(body, { generate: 'client' });
        } catch {
            accepted = false;
        }

        if (accepted) expect(() => compileSvelte(emitted, { generate: 'client' })).not.toThrow();
    });
});
