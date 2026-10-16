// @vitest-environment node
//
// **The crossing stands without Svelte and without the runtime**, the core
// Bryntime is to be: `crossing.js` imports the engine and nothing else, and
// loaded alone, with no host to answer, it still turns JavaScript values into
// Python ones and back. What a host adds, the states it owns and how it makes
// an object one of them, is asked through `host`, which answers nothing here.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import '../src/lib/compile.cjs';
import { host, pyData, plainData, entering, pyBind, NONE } from '../src/lib/crossing.js';

test('crossing.js imports the engine, and nothing of Svelte or of the runtime', () => {
    const source = readFileSync('src/lib/crossing.js', 'utf8');
    const imports = [...source.matchAll(/^import\s+(?:[^'";]*\s+from\s+)?'([^']+)';/gm)].map(([, from]) => from);

    expect(imports).toEqual(['./globals.js', './boot.js']);
});

test('loaded alone, with no host, it crosses data both ways', () => {
    const $B = globalThis.__BRYTHON__;
    const python = pyData({ name: 'a', rows: [1, 2.5, { deep: null }] });

    expect($B.class_name(python)).toBe('dict');
    expect(plainData(python)).toEqual({ name: 'a', rows: [1, 2.5, { deep: null }] });
    expect(pyBind(undefined)).toBe(NONE);
    expect(host.owns(python)).toBe(false);
    expect($B.class_name(entering({ n: 1 }))).toBe('dict');
});
