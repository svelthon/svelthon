// @vitest-environment node
//
// The one unguarded coupling in the project, made guarded.
//
// `markup.js` writes the calls a compiled template expression makes — `__event`,
// `__truthy`, `__assign` and the rest — and `compile.cjs` emits their
// definitions. The two files must agree on eleven spellings and they cannot
// share a constant: one is ESM and loads in a browser for the playground, the
// other is CommonJS because Brython has to execute after its globals exist,
// which ES imports cannot order. `require` does not reach across that line.
//
// So the agreement is checked instead of imported. Every `__name` invented in
// the markup pass must either have a definition in the compiler, or be named
// below as markup-local, which is a deliberate act rather than an oversight.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (name) =>
    readFileSync(fileURLToPath(new URL(`../src/lib/${name}`, import.meta.url)), 'utf8');

// Names the markup writes for itself, which the compiler never sees.
const MARKUP_LOCAL = new Set([
    // The setter's parameter in the `bind:` pair, consumed by Svelte.
    '__value',
    // The loop variable of a compiled `{#each}` over a range.
    '__range_',
    // A stand-in used by the first, throwaway walk that only collects snippet
    // names; nothing it returns is emitted.
    '__probe'
]);

test('every generated name the markup writes is defined by the compiler', () => {
    const markup = read('markup.js');
    const compiler = read('compile.cjs');

    const written = [...new Set([...markup.matchAll(/__[a-z][\w]*/g)].map((one) => one[0]))]
        .filter((one) => !MARKUP_LOCAL.has(one))
        .sort();

    // The list is not written out here on purpose: it is read from the file that
    // invents the names, so a twelfth one cannot arrive unnoticed.
    expect(written.length).toBeGreaterThan(10);

    expect(written.filter((one) => !compiler.includes(one))).toEqual([]);
});

test('and a name the compiler stopped emitting turns this red', () => {
    // The failure this guards against, spelled out: renaming one side only.
    const compiler = read('compile.cjs').replace(/__event/g, '__handler');

    expect(compiler.includes('__event')).toBe(false);
});
