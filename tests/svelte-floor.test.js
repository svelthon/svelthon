// @vitest-environment node
//
// **The Svelte a project needs is the one that reads what Svelthon emits.** An
// `{#each}`, a value a block declares and a Python snippet each become a
// declaration tag, `{const …}` or `{let …}`, which Svelte reads from 5.56.0 on:
// 5.55.10 refuses both components measured, "Unexpected token" and "The keyword
// 'let' is reserved", and 5.56.0 compiles them, with every internal function
// the runtime imports. The peer dependency said `^5.0.0`, so a project on an
// older Svelte installed cleanly and failed to build its first loop.
//
// What a test sees without a second Svelte installed: that the markup emits the
// tag, and that the floor declared is the one that reads it.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pythonExpressions, collector } from '../src/lib/markup.js';
// The parser the names an expression reads are read with, which the plugin
// has loaded before any markup is read.
import '../src/lib/compile.js';

const READS_DECLARATION_TAGS = [5, 56, 0];

test('the Svelte the package asks for reads the declaration tags its markup emits', () => {
    expect(pythonExpressions('{#each rows as row}{row}{/each}', collector([]))).toMatch(/^\{const __rows_/);

    const asked = JSON.parse(readFileSync('package.json', 'utf8')).peerDependencies.svelte;
    const floor = asked.match(/^\^(\d+)\.(\d+)\.(\d+)$/).slice(1).map(Number);
    const below = floor.findIndex((part, at) => part !== READS_DECLARATION_TAGS[at]);

    expect(below === -1 || floor[below] > READS_DECLARATION_TAGS[below], `${asked} admits a Svelte that refuses them`).toBe(
        true
    );
});
