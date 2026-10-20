// @vitest-environment node
//
// **Svelthon reaches Bryc by its name alone**, `bryc`, the one module its
// package exports: no file of Svelthon imports, requires or names a file of
// it, which stay Bryc's to split, move or rename. What Bryc holds and reaches
// is Bryc's to guard, in its own tests.
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// A file of Bryc's, by its path into the package. This file holds the pattern,
// so it is the one file not read.
const BRYC_FILE = /\bbryc\/[\w./-]*\.[cm]?js\b/;

// The files under `dir` that `keep` takes, by their path from it, past what is
// installed, built or a scratch probe.
const SKIPPED = new Set(['node_modules', 'scratch', 'build', '.svelte-kit']);

const within = (dir, keep, from = '') =>
    readdirSync(join(dir, from), { withFileTypes: true }).flatMap((entry) => {
        const path = join(from, entry.name);

        if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : within(dir, keep, path);

        return keep(path) ? [join(dir, path)] : [];
    });

// A statement that imports, not a string that reads like one: `import … from`,
// `export … from` and the `} from` that ends one written over several lines, a
// bare `import`, a `require(` and an `import(`.
const IMPORTED = /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s+|^\s*\}\s*from\s+|^\s*import\s+|\brequire\(\s*|\bimport\(\s*)['"]([^'"]+)['"]/g;

const files = () => [
    ...within('src', (file) => /\.[cm]?js$/.test(file)),
    ...within('tests', (file) => /\.[cm]?js$/.test(file) && file !== 'bryc-door.test.js'),
    ...within('scripts', (file) => /\.(sh|[cm]?js)$/.test(file))
];

test('nothing of Svelthon names a file of Bryc', () => {
    const named = files().flatMap((file) =>
        readFileSync(file, 'utf8')
            .split('\n')
            .map((line, index) => [`${file}:${index + 1}`, line])
            .filter(([, line]) => BRYC_FILE.test(line))
            .map(([where, line]) => `${where}: ${line.trim()}`)
    );

    expect(files().length).toBeGreaterThan(100);
    expect(named).toEqual([]);
});

test('and what imports Bryc imports it by its name', () => {
    const imported = files().flatMap((file) =>
        readFileSync(file, 'utf8')
            .split('\n')
            .flatMap((line, index) => [...line.matchAll(IMPORTED)].map(([, to]) => [`${file}:${index + 1}`, to]))
            .filter(([, to]) => /(^|\/)bryc\b/.test(to))
    );

    expect(imported.filter(([, to]) => to !== 'bryc')).toEqual([]);
    expect(imported.map(([where]) => where.replace(/:\d+$/, ''))).toEqual(['src/lib/compile.js', 'src/lib/markup.js']);
});
