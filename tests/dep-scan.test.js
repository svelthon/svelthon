// @vitest-environment node
//
// Vite's dependency scanner reads each `<script>` of a `.svelte` file as
// JavaScript, the Python one too: every cold start said `Failed to run
// dependency scan`, `Expected a semicolon` on a Python import, a SvelteKit
// project once per page. The plugin hands the scan what the Python imports from
// JavaScript instead, and leaves a JavaScript script as it is. And the bridge
// the compiled component imports: told nothing of it, Vite found the engine and
// `esm-env` at the first visit and reloaded the page.
import { test, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { svelthon } from '../src/lib/svelthon.js';

const file = fileURLToPath(new URL('./fixtures/ScannedScripts.svelte', import.meta.url));
const scripts = [...readFileSync(file, 'utf8').matchAll(/<script[^>]*>(.*?)<\/script>/gs)].map((one) => one[1]);

// The config hook as Vite calls it, its version told by `this.meta`.
const configured = (meta) => svelthon().config.call({ meta }).optimizeDeps;

test('the scanner is handed what a Python script imports from JavaScript', () => {
    const [scan] = configured({ viteVersion: '8.2.1', rolldownVersion: '1.0.0' }).rolldownOptions.plugins;
    const scanned = (at) => scan.transform(scripts[at], `virtual-module:${file}?id=${at}`);

    expect(scanned(0)).toBe(null);
    expect(scanned(1)).toEqual({ code: 'import "svelthon/bridge";\nimport "svelte/motion";\nimport "./Child.svelte";', moduleType: 'js' });
});

// Vite 7 scans with esbuild and reads no `rolldownOptions`: the error was
// there at every cold start. Its loader of a script is asked after the
// config's, which hands the Python script over itself, read off the file.
test('and so is the scanner of Vite 7, by an esbuild plugin', () => {
    const options = configured({ viteVersion: '7.3.8' });
    const loaders = [];

    options.esbuildOptions.plugins[0].setup({ onLoad: (filter, load) => loaders.push([filter, load]) });

    const [[filter, load]] = loaders;
    const path = (at) => `${file}?id=${at}`;

    expect(options.rolldownOptions).toBe(undefined);
    expect(filter.namespace).toBe('script');
    expect(filter.filter.test(path(1))).toBe(true);
    expect(load({ path: path(0) })).toBe(undefined);
    expect(load({ path: path(1) })).toEqual({
        contents: 'import "svelthon/bridge";\nimport "svelte/motion";\nimport "./Child.svelte";',
        loader: 'js',
        resolveDir: dirname(file)
    });
});

test('and Vite 8 is handed no esbuild option, which it warns of', () => {
    expect(configured({ viteVersion: '8.2.1', rolldownVersion: '1.0.0' }).esbuildOptions).toBe(undefined);
});
