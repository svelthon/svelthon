// @vitest-environment node
//
// **Bryc is reached by one door**, `bryc.js`: no file outside its folder
// requires, imports or names another of its files, which stay Bryc's to split,
// move or rename. And Bryc holds nothing of the framework it serves: it reaches
// no file outside its folder, and its code names neither Svelte nor a rune nor
// the bridge, so it can leave as a package of its own.
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const BRYC = 'src/lib/bryc';
const DOOR = `${BRYC}/bryc.js`;

// A file of Bryc's other than its door, by its path. This file holds the
// pattern, so it is the one file not read.
const BRYC_FILE = /bryc\/(?!bryc\.js\b)[\w.-]+\.[cm]?js\b/;

// The files under `dir` that `keep` takes, by their path from it, past what is
// installed, built or a scratch probe.
const SKIPPED = new Set(['node_modules', 'scratch', 'build', '.svelte-kit']);

const within = (dir, keep, from = '') =>
    readdirSync(join(dir, from), { withFileTypes: true }).flatMap((entry) => {
        const path = join(from, entry.name);

        if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : within(dir, keep, path);

        return keep(path) ? [join(dir, path)] : [];
    });

const lines = (file) =>
    readFileSync(file, 'utf8')
        .split('\n')
        .map((line, index) => [`${file}:${index + 1}`, line]);

// The code of a file, its comments blanked, line for line.
const code = (file) =>
    readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
        .split('\n')
        .map((line, index) => [`${file}:${index + 1}`, line.replace(/(^|\s)\/\/.*$/, '')]);

// A statement that imports, not a string that reads like one: `import … from`,
// `export … from` and the `} from` that ends one written over several lines, a
// bare `import`, a `require(` and an `import(`.
const IMPORTED = /(?:^\s*(?:import|export)\b[^'"]*?\bfrom\s+|^\s*\}\s*from\s+|^\s*import\s+|\brequire\(\s*|\bimport\(\s*)['"]([^'"]+)['"]/g;

test('nothing outside Bryc reaches a file of it but its door', () => {
    const files = [
        ...within('src/lib', (file) => /\.[cm]?js$/.test(file) && !file.startsWith('bryc/')),
        ...within('tests', (file) => /\.[cm]?js$/.test(file) && file !== 'bryc-door.test.js'),
        ...within('scripts', (file) => /\.(sh|[cm]?js)$/.test(file))
    ];
    const named = files.flatMap((file) =>
        lines(file)
            .filter(([, line]) => BRYC_FILE.test(line))
            .map(([where, line]) => `${where}: ${line.trim()}`)
    );

    expect(files.length).toBeGreaterThan(100);
    expect(named).toEqual([]);
});

test('Bryc reaches no file outside its folder', () => {
    const reached = within(BRYC, (file) => /\.[cm]?js$/.test(file)).flatMap((file) =>
        code(file).flatMap(([where, line]) =>
            [...line.matchAll(/(?:from\s+|require\(\s*|import\s*\(?\s*)['"](\.\.?\/[^'"]*)['"]/g)]
                .filter(([, to]) => !to.startsWith('./') || to.includes('/../'))
                .map(([, to]) => `${where}: ${to}`)
        )
    );

    expect(reached).toEqual([]);
});

// And of the packages, Bryve alone, the engine started and then its parsing
// chain: Bryc runs on Brython, never on a host's runtime, Bryntime included.
test('Bryc imports no package but Bryve, Bryntime none', () => {
    const packages = within(BRYC, (file) => /\.[cm]?js$/.test(file)).flatMap((file) =>
        code(file).flatMap(([where, line]) =>
            [...line.matchAll(IMPORTED)].filter(([, to]) => !to.startsWith('.')).map(([, to]) => `${where}: ${to}`)
        )
    );

    expect(packages.filter((one) => /: bryntime\b/.test(one))).toEqual([]);
    expect(packages.map((one) => one.replace(/^.*: /, ''))).toEqual(['bryve', 'bryve/compiler']);
});

// Bryc's own tests, `tests/bryc/`, reach it by its door and by nothing else:
// no fixture, no file of the host's, no other package, a host of their own
// written in the test. `vitest` is what runs them. They leave with Bryc, so
// they hold nothing that stays.
test("Bryc's own tests import its door and nothing else", () => {
    const files = within('tests/bryc', () => true);
    const imported = files.flatMap((file) =>
        code(file).flatMap(([where, line]) =>
            [...line.matchAll(IMPORTED)]
                .filter(([, to]) => to !== 'vitest' && resolve(dirname(file), to) !== resolve(DOOR))
                .map(([, to]) => `${where}: ${to}`)
        )
    );

    expect(files.length).toBeGreaterThan(0);
    expect(files.filter((file) => !file.endsWith('.test.js'))).toEqual([]);
    expect(imported).toEqual([]);
});

// A dependency names none of its dependents, in its code or in what it says of
// itself: a comment may take a framework for its example, never a tool built on
// Bryc.
test('Bryc names no tool built on it, comments included', () => {
    const named = within(BRYC, (file) => /\.[cm]?js$/.test(file)).flatMap((file) =>
        lines(file)
            .filter(([, line]) => /svelthon|vuython/i.test(line))
            .map(([where, line]) => `${where}: ${line.trim()}`)
    );

    expect(named).toEqual([]);
});

test('the code of Bryc names no framework, no rune and no bridge', () => {
    const files = within(BRYC, (file) => /\.[cm]?js$/.test(file));
    const named = files.flatMap((file) =>
        code(file)
            .filter(([, line]) => /svelte|svelthon|__pybridge|\$(?:state|derived|effect|props|bindable|inspect|host)\b/i.test(line))
            .map(([where, line]) => `${where}: ${line.trim()}`)
    );

    expect(files.length).toBeGreaterThan(0);
    expect(named).toEqual([]);
});
