// @vitest-environment node
//
// **Every module of Svelthon is an ES module**: no file is `.cjs`, and no code
// requires, builds a `require` or exports as CommonJS does. What has to load
// first is imported first, as static imports run in the order written.
//
// The one CommonJS file Svelthon began with was so to load a classic
// `brython.js` after globals, a reason Bryntime ended. The format was copied
// on long after, and it broke the markup pass in a browser.
import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Past what is installed, built or a scratch probe.
const SKIPPED = new Set(['node_modules', 'scratch', 'build', '.svelte-kit']);

const within = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const path = join(dir, entry.name);

        if (entry.isDirectory()) return SKIPPED.has(entry.name) ? [] : within(path);

        return [path];
    });

const files = [...['src', 'tests', 'scripts', 'demo'].flatMap(within), ...readdirSync('.').filter((one) => /\.[cm]?js$/.test(one))];

// The code of a file, its comments blanked, line for line. This file holds
// the patterns, so it is the one file not read.
const code = (file) =>
    readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ''))
        .split('\n')
        .map((line, index) => [`${file}:${index + 1}`, line.replace(/(^|\s)\/\/.*$/, '')]);

const COMMONJS = /\brequire\(|\bcreateRequire\b|\bmodule\.exports\b|\bexports\.\w+\s*=/;

test('every module of Svelthon is an ES module', () => {
    const scripts = files.filter((file) => /\.(?:[cm]?js|svelte)$/.test(file) && file !== join('tests', 'es-modules.test.js'));
    const commonjs = scripts.flatMap((file) =>
        code(file)
            .filter(([, line]) => COMMONJS.test(line))
            .map(([where, line]) => `${where}: ${line.trim()}`)
    );

    expect(scripts.length).toBeGreaterThan(100);
    expect(files.filter((file) => file.endsWith('.cjs'))).toEqual([]);
    expect(commonjs).toEqual([]);
});
