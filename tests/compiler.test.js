// @vitest-environment node
//
// The compiler is build-time code: jsdom has no business here, and its null
// `document.currentScript` would break Brython's bootstrap.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

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

    test('a Python name reserved in JS stays usable, without being published', () => {
        // `class` and `new` are valid Python identifiers.
        const { script } = compile('class_ = 1\nnew = 2\nok = 3\n', 'R', 'R.svelte');

        expect(script).toContain('let ok = $state.raw');
        expect(script).toContain('let class_ = $state.raw');
        expect(script).not.toMatch(/let new =/); // otherwise the JS would not compile
    });

    test('every state name gets its revision signal', () => {
        // Two signals per name: the value, and a counter the getter reads — it
        // is the counter that makes an in-place mutation visible without a copy.
        const { script } = compile('items = []\n', 'R', 'R.svelte');

        expect(script).toContain('let __rev_items = $state.raw(0)');
        expect(script).toContain('const __bump_items = () => { __rev_items += 1; }');
        expect(script).toContain("bind(__proto, 'items', () => (__rev_items, items)");
        expect(script).toContain('track(v, __bump_items, __read_items)');
    });

    test('a store folds annotations into state and registers itself for Python', () => {
        const { script } = compile('n: int = 0\n', 'S', 'src/lib/shop.py', { store: true });

        expect(script).not.toContain('$props()'); // a store has no parent
        expect(script).toContain('let n = $state.raw');
        expect(script).toContain('registerModule("shop"');
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

    // `vendor/brython.js` is patched in place for this one — it cannot go
    // through VENDOR_PATCHES, which is a Vite plugin, where the compiler runs
    // under Node. A direct edit is lost silently when a newer Brython is
    // vendored, so this test is the guard: it fails the moment the patch is
    // gone. See BRYTHON.md.
    test('a path builds a valid identifier, and __file__ keeps the real path', () => {
        const { module } = compile('x = 1\n', 'C', 'src/routes/+page.server.py');

        // Upstream neutralises only '.', so this read `locals_src/routes/…`,
        // which is a SyntaxError — and only when the generated code was run.
        expect(module).toContain('locals_src_routes__page_server_py = $B.namespace(');
        expect(module).not.toMatch(/locals_[\w$]*\//);

        // The point of the patch: a traceback naming the file, not a slug.
        expect(module).toContain("__file__ = 'src/routes/+page.server.py'");
    });

    // The other edit made in `vendor/brython.js` itself. Upstream reported the
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
    test('a JavaScript import is wrapped once, not on every read', () => {
        const { script } = compile(
            '__js__ = {"@sveltejs/kit": ["error"]}\n__all__ = ["load"]\n\ndef load():\n    return {}\n',
            'M',
            'src/routes/+page.server.py',
            { plain: true }
        );

        expect(script).toContain('const __js_error = jsCall(error);');
        expect(script).toContain("bind(__proto, 'error', () => __js_error");
    });

    test('a component imports the pyArg that to_python depends on', () => {
        // It was bound without being imported: a ReferenceError on the first
        // read of to_python, and on that one alone.
        const { script } = compile('x = 1\n', 'C', 'src/C.svelte');

        expect(script).toMatch(/import \{[^}]*\bpyArg\b[^}]*\} from 'svelthon\/runtime'/);
        expect(script).toContain("bind(__proto, 'to_python', () => pyArg");
    });
});
