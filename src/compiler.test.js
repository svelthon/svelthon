// @vitest-environment node
//
// Le compilateur est du code de build : jsdom n'a rien à y faire, et son
// `document.currentScript` nul casserait le bootstrap de Brython.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compile } = require('./lib/compile.cjs');

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

    test('un composant qui définit son propre publish garde le sien', () => {
        const mine = compile('def publish(k):\n    pass\n', 'P', 'P.svelte').script;
        const injected = compile('x = 1\n', 'Q', 'Q.svelte').script;

        expect(mine).not.toContain('const __publish =');
        expect(injected).toContain('const __publish =');
    });

    test('un store replie les annotations en état et s’enregistre pour Python', () => {
        const { script } = compile('n: int = 0\n', 'S', 'src/lib/shop.py', { store: true });

        expect(script).not.toContain('$props()'); // pas de parent à un store
        expect(script).toContain('let n = $state.raw');
        expect(script).toContain('registerModule("shop"');
    });
});
