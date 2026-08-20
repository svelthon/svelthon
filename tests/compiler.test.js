// @vitest-environment node
//
// Le compilateur est du code de build : jsdom n'a rien à y faire, et son
// `document.currentScript` nul casserait le bootstrap de Brython.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');

// Le compilateur n'était testé qu'à travers des composants montés — donc
// uniquement par ses chemins heureux. Ceux-ci ne passent par aucun rendu.
describe('compilateur', () => {
    test('une erreur de syntaxe Python est lisible', () => {
        // Sans traitement, une exception Brython arrive avec message: undefined
        // et Vite ne rapporte rien du tout.
        expect(() => compile('\ncount = 0\n\ndef broken(\n    return count\n', 'S', 'src/S.svelte'))
            .toThrow(/SyntaxError: '\(' was never closed \(src\/S\.svelte:4\)/);
    });

    test('l’erreur nomme la ligne du fichier, pas celle du script', () => {
        expect(() => compile('\nx = )\n', 'S', 'src/S.svelte', { lineOffset: 10 })).toThrow(
            /src\/S\.svelte:12/
        );
    });

    test('un nom Python réservé en JS reste utilisable, sans être publié', () => {
        // `class` et `new` sont des identifiants Python valides.
        const { script } = compile('class_ = 1\nnew = 2\nok = 3\n', 'R', 'R.svelte');

        expect(script).toContain('let ok = $state.raw');
        expect(script).toContain('let class_ = $state.raw');
        expect(script).not.toMatch(/let new =/); // sinon le JS ne compilerait pas
    });

    test('chaque nom d’état reçoit son signal de révision', () => {
        // Deux signaux par nom : la valeur, et un compteur que le getter lit —
        // c'est lui qui rend une mutation en place visible sans copie.
        const { script } = compile('items = []\n', 'R', 'R.svelte');

        expect(script).toContain('let __rev_items = $state.raw(0)');
        expect(script).toContain('const __bump_items = () => { __rev_items += 1; }');
        expect(script).toContain("bind(__proto, 'items', () => (__rev_items, items)");
        expect(script).toContain('track(v, __bump_items, __read_items)');
    });

    test('un store replie les annotations en état et s’enregistre pour Python', () => {
        const { script } = compile('n: int = 0\n', 'S', 'src/lib/shop.py', { store: true });

        expect(script).not.toContain('$props()'); // pas de parent à un store
        expect(script).toContain('let n = $state.raw');
        expect(script).toContain('registerModule("shop"');
    });

    // Brython scatters `$B.set_lineno(frame, N)` through its output, which is
    // enough to map generated lines back to Python ones. A map that points at
    // the wrong line is worse than no map, so decode it and check.
    test('la source map renvoie à la bonne ligne Python', () => {
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

        // Décodage VLQ minimal : un segment par ligne générée, delta-encodé.
        const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        let sourceLine = 0;
        const lineFor = map.mappings.split(';').map((segment) => {
            if (!segment) return null;
            let value = 0;
            let shift = 0;
            let index = 2; // on saute colonne générée et index de source
            for (;;) {
                const digit = CHARS.indexOf(segment[index++]);
                value += (digit & 31) << shift;
                if (!(digit & 32)) break;
                shift += 5;
            }
            sourceLine += value & 1 ? -(value >> 1) : value >> 1;
            return sourceLine;
        });

        // `count += 1` est ligne 6 du fichier ; on retrouve la ligne générée qui
        // porte son marqueur et on vérifie où la carte l'envoie.
        const generated = module.split('\n').findIndex((l) => /set_lineno\(frame, 6\)/.test(l));

        expect(generated).toBeGreaterThan(0);
        expect(lineFor[generated]).toBe(5); // 0-indexé : ligne 6 du fichier
    });

    // La frontière vers JavaScript est posée à la compilation ; ce qu'elle fait
    // ensuite est vérifié dans boundary.test.js.
    test('un import JavaScript est enveloppé une fois, pas à chaque lecture', () => {
        const { script } = compile(
            '__js__ = {"@sveltejs/kit": ["error"]}\n__all__ = ["load"]\n\ndef load():\n    return {}\n',
            'M',
            'src/routes/+page.server.py',
            { plain: true }
        );

        expect(script).toContain('const __js_error = jsCall(error);');
        expect(script).toContain("bind(__proto, 'error', () => __js_error");
    });

    test('un composant importe le pyArg dont dépend to_python', () => {
        // Il était lié sans être importé : une ReferenceError à la première
        // lecture de to_python, et à celle-là seulement.
        const { script } = compile('x = 1\n', 'C', 'src/C.svelte');

        expect(script).toMatch(/import \{[^}]*\bpyArg\b[^}]*\} from 'svelthon\/runtime'/);
        expect(script).toContain("bind(__proto, 'to_python', () => pyArg");
    });
});
