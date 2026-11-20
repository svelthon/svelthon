// A plugin ahead of Svelte's that writes one file two ways, as a plugin may for
// `?variant=alpha` and `?variant=beta`: the word `"BASE"` becomes the variant's
// name, in the fixtures of `variant-bodies.test.js` alone. And one that makes
// a file another language, `?language=python` or `?language=javascript`, its
// text then the other card's, in the fixtures of `language-variants.test.js`.
import { readFileSync } from 'node:fs';

const CARDS = { python: 'LanguageCardPython.svelte', javascript: 'LanguageCardNative.svelte' };

export function variants() {
    return {
        name: 'svelthon-test-variants',
        enforce: 'pre',
        transform(code, id) {
            const [file, query] = id.split('?');

            if (/\/tests\/fixtures\/LanguageCard(?:Native|Python)\.svelte$/.test(file)) {
                const card = CARDS[new URLSearchParams(query).get('language')];

                return card === undefined ? undefined : { code: readFileSync(new URL(`./fixtures/${card}`, import.meta.url), 'utf8'), map: null };
            }

            if (!/\/tests\/fixtures\/Variant(?:Native)?\.svelte\?/.test(id)) return;

            const variant = new URLSearchParams(query).get('variant');

            return { code: code.replace('"BASE"', JSON.stringify(variant)), map: null };
        }
    };
}
