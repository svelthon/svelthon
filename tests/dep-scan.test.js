// @vitest-environment node
//
// Vite's dependency scanner reads each `<script>` of a `.svelte` file as
// JavaScript, the Python one too: every cold start said `Failed to run
// dependency scan`, `Expected a semicolon` on a Python import, a SvelteKit
// project once per page. The plugin hands the scan what the Python imports from
// JavaScript instead, and leaves a JavaScript script as it is. And the bridge
// the compiled component imports: told nothing of it, Vite found the engine and
// `esm-env` at the first visit and reloaded the page.
import { test, expect, vi } from 'vitest';
import { fileURLToPath } from 'node:url';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
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

// Whether a script is Python is read as every other site reads it, `lang` an
// attribute of its own. Vite's pattern took the `lang` of a `data-lang`, or a
// `lang='js'` in another attribute's value: the cold start skipped
// pre-bundling, or a JavaScript script went over as Python and its imports were
// lost. Which scripts get a number stays Vite's reading, `data-type` included,
// or the number names another script.
const PYTHON = '\n    importjs { tweened } from "svelte/motion"\n';
const JAVASCRIPT = "\n    import { cubicOut } from 'svelte/easing';\n";
const IMPORTS = { code: 'import "svelthon/bridge";\nimport "svelte/motion";', moduleType: 'js' };

test.each([
    [`<script data-lang="js" lang="python">${PYTHON}</script>`, PYTHON, IMPORTS],
    [`<script data-note="lang='js'" lang="python">${PYTHON}</script>`, PYTHON, IMPORTS],
    [`<script generics="lang='js'" lang="python">${PYTHON}</script>`, PYTHON, IMPORTS],
    [`<script data-note="lang='python'">${JAVASCRIPT}</script>`, JAVASCRIPT, null],
    [`<script data-type="text/x" lang="python">${PYTHON}</script>\n<script module>${JAVASCRIPT}</script>`, JAVASCRIPT, null]
])('the script Vite numbers 0 in %s', (source, script, expected) => {
    const [scan] = configured({ viteVersion: '8.2.1', rolldownVersion: '1.0.0' }).rolldownOptions.plugins;
    const dir = mkdtempSync(join(tmpdir(), 'svelthon-scan-'));
    const component = join(dir, 'App.svelte');

    try {
        writeFileSync(component, source);
        expect(scan.transform(script, `virtual-module:${component}?id=0`)).toEqual(expected);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

// The script is read as the compile reads it, with the names its `<script
// module>` binds: a call of the module's own `inspect_with(*values)` was read
// as Svelthon's and refused, and the scan was handed the bridge alone. And the
// `importjs` lines of a script whose Python does not read are still handed.
test.for([
    ['a call of the module’s inspect_with()', `${PYTHON}    inspect_with(*[7])\n`, '<script module>\n    const inspect_with = (...values) => values;\n</script>\n'],
    ['Python that does not read', `${PYTHON}    def (\n`, '']
])('the imports of a Python script are handed over past %s', ([, script, module]) => {
    const [scan] = configured({ viteVersion: '8.2.1', rolldownVersion: '1.0.0' }).rolldownOptions.plugins;
    const dir = mkdtempSync(join(tmpdir(), 'svelthon-scan-'));
    const component = join(dir, 'App.svelte');

    try {
        writeFileSync(component, `${module}<script lang="python">${script}</script>\n`);
        expect(scan.transform(script, `virtual-module:${component}?id=${module ? 1 : 0}`)).toEqual(IMPORTS);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
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

// A package only a `.py` brought was found at the first visit, optimized then,
// and the page reloaded when it shared code with one optimized already: the
// scan reads the files of Python's imports as it reads JavaScript's, whichever
// way a `.py` is reached, by the scanner of Vite itself.
const DECLARES = '__js__ = {"devalue": ["stringify"]}\n\ndef sample():\n    return stringify(7)\n';
const COMPONENT = '<script lang="python">\nfrom reading import sample\n</script>\n<p>{sample()}</p>\n';
const MOUNTED = "import App from './App.svelte';\nconsole.log(App);\n";

test.for([
    ['a component', { 'main.js': MOUNTED, 'App.svelte': COMPONENT, 'reading.py': DECLARES }],
    ['JavaScript', { 'main.js': "import { sample } from './reading.py';\nconsole.log(sample);\n", 'reading.py': DECLARES }],
    ['a module a component imports', { 'main.js': MOUNTED, 'App.svelte': COMPONENT, 'reading.py': 'from codec import sample\n', 'codec.svelte.py': DECLARES }],
    ['a component, along the path', { 'main.js': MOUNTED, 'App.svelte': COMPONENT, 'lib/reading.py': DECLARES }, (room) => ({ path: [join(room, 'lib')] })]
])('the scan finds the package a .py declares, imported by %s', async ([, files, options]) => {
    const { createServer } = await import('vite');
    const room = mkdtempSync(join(tmpdir(), 'svelthon-scan-'));

    for (const [name, text] of Object.entries({ 'index.html': '<script type="module" src="/main.js"></script>\n', ...files })) {
        mkdirSync(dirname(join(room, name)), { recursive: true });
        writeFileSync(join(room, name), text);
    }
    symlinkSync(resolve('node_modules'), join(room, 'node_modules'));

    const server = await createServer({
        configFile: false,
        root: room,
        cacheDir: join(room, '.vite'),
        logLevel: 'silent',
        plugins: [svelthon(options?.(room))],
        resolve: { alias: { 'svelthon/bridge': fileURLToPath(new URL('../src/lib/bridge.js', import.meta.url)) } },
        server: { port: 0, hmr: false },
        optimizeDeps: { force: true }
    });

    try {
        await server.listen();

        // The scan's packages are known together, Svelte the bridge's.
        const known = () => {
            const { metadata } = server.environments.client.depsOptimizer;

            return { ...metadata.optimized, ...metadata.discovered };
        };

        await vi.waitFor(() => expect(known()).toHaveProperty('svelte'), { timeout: 20000 });
        expect(known()).toHaveProperty('devalue');
    } finally {
        await server.close();
        rmSync(room, { recursive: true, force: true });
    }
});

// SvelteKit hands the scan its route modules by a pattern of its own, whatever
// `moduleExtensions` names: what a `+page.py` brought was found at its first
// visit. Its entries as SvelteKit gives them, as the scan reads them.
test('and the route modules SvelteKit hands the scan, Python among them', async () => {
    const { resolveConfig } = await import('vite');
    const kit = { name: 'kit-entries', config: () => ({ optimizeDeps: { entries: ['src/routes/**/+*.{svelte,js,ts}', '!src/routes/**/+*server.*'] } }) };
    const config = await resolveConfig({ configFile: false, logLevel: 'silent', plugins: [kit, svelthon()] }, 'serve');

    expect(config.environments.client.optimizeDeps.entries).toEqual(['src/routes/**/+*.{svelte,js,ts}', '!src/routes/**/+*server.*', 'src/routes/**/+*.py']);
});

// Vite hands its optimizer the scan's plugins too: there a `.py` is read as it
// was, told apart from the scan by the scan's own plugin.
test("and Vite 8's optimizer reads a .py as it did", () => {
    const [scan] = configured({ viteVersion: '8.2.1', rolldownVersion: '1.0.0' }).rolldownOptions.plugins;

    scan.options({ plugins: [{ name: 'vite:dep-pre-bundle' }] });
    expect(scan.transform(DECLARES, '/project/reading.py')).toBe(null);

    scan.options({ plugins: [{ name: 'vite:dep-scan:resolve' }] });
    expect(scan.transform(DECLARES, '/project/reading.py')).toEqual({ code: 'import "svelthon/bridge";\nimport "devalue";', moduleType: 'js' });
});

test("and Vite 7's scan reads a .py, its optimizer as it did", () => {
    const loaders = (plugins) => {
        const found = [];

        configured({ viteVersion: '7.3.8' }).esbuildOptions.plugins[0].setup({ initialOptions: { plugins }, onLoad: (filter, load) => found.push([filter, load]) });
        return found;
    };
    const dir = mkdtempSync(join(tmpdir(), 'svelthon-scan-'));
    const module = join(dir, 'reading.py');

    try {
        writeFileSync(module, DECLARES);
        expect(loaders([{ name: 'vite:dep-pre-bundle' }])).toHaveLength(1);

        const [, [filter, load]] = loaders([{ name: 'vite:dep-scan' }]);

        expect(filter.filter.test(module)).toBe(true);
        expect(load({ path: module })).toEqual({ contents: 'import "svelthon/bridge";\nimport "devalue";', loader: 'js', resolveDir: dir });
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
