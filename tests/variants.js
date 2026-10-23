// A plugin ahead of Svelte's that writes one file two ways, as a plugin may for
// `?variant=alpha` and `?variant=beta`: the word `"BASE"` becomes the variant's
// name, in the fixtures of `variant-bodies.test.js` alone.
export function variants() {
    return {
        name: 'svelthon-test-variants',
        enforce: 'pre',
        transform(code, id) {
            if (!/\/tests\/fixtures\/Variant(?:Native)?\.svelte\?/.test(id)) return;

            const variant = new URLSearchParams(id.split('?')[1]).get('variant');

            return { code: code.replace('"BASE"', JSON.stringify(variant)), map: null };
        }
    };
}
