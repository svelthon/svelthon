// @vitest-environment node
//
// **The runtime takes from Svelte only what Svelte publishes**, so it can serve
// another host. What only Svelte's internals could answer is written by the
// compiler, in runes, into the scripts Svelte compiles: `$effect.tracking()`,
// handed to the runtime as a component or store loads, and the derived and the
// effect an `{#each}` walks with (`__brycomp_collection`). The first was imported as
// `effect_tracking`, from `svelte/internal/client`, which no semver covers.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

test('bridge.js imports from Svelte its public API alone', () => {
    const source = readFileSync('src/lib/bridge.js', 'utf8');
    const imports = [...source.matchAll(/^import\s*\{([^}]*)\}\s*from\s*'(svelte[^']*)';/gm)].map(
        ([, names, from]) => `${from}: ${names.replace(/\s+/g, ' ').trim()}`
    );

    expect(imports).toEqual(['svelte: untrack', 'svelte/reactivity: createSubscriber']);
    expect(source).not.toMatch(/['"]svelte\/internal/);
});
