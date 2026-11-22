import { defineConfig, configDefaults } from 'vitest/config';
import { svelte, vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { python, svelthon, compileOptionsFor } from './src/lib/svelthon.js';
import { demoStats } from './demo/stats.js';
import { variants } from './tests/variants.js';

// TypeScript's own transform, which the fixtures under `tests/fixtures/typescript/`
// go through after Python's, as an application's do: an `enum` or a namespace
// is JavaScript only through it.
const typescript = vitePreprocess({ script: true });

export default defineConfig({
    plugins: [demoStats(), variants(), svelthon(), svelte({
            preprocess: [
                python({ path: ['demo'] }),
                { script: (input) => (input.filename?.includes('fixtures/typescript/') ? typescript.script(input) : undefined) }
            ],
            // vite-plugin-svelte's module filter, widened to Python: a
            // `.svelte.py` compiles as a `.svelte.ts` does, under its own name.
            experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } },
            // A component that declares a custom element is compiled as one.
            dynamicCompileOptions: ({ code }) => compileOptionsFor(code),
            // The fixtures under `tests/fixtures/warned/` warn on purpose, and
            // their tests read the warnings from the compiler: printed by the
            // plugin as well, they were what a green run said.
            onwarn: (warning, warn) => warning.filename?.includes('fixtures/warned/') || warn(warning)
        })],
    resolve: {
        alias: {
            'svelthon/bridge': fileURLToPath(new URL('./src/lib/bridge.js', import.meta.url))
        },
        conditions: ['browser']
    },

    optimizeDeps: {
        // Vite's dependency scanner runs ahead of the plugin pipeline: it reads
        // the HTML entries, finds `<script lang="python">` and hands the Python
        // to a JavaScript parser, then fails on `./store.py` because no file of
        // that name is meant to be loaded directly. Its only job here is to
        // discover bare imports, so we name them and skip the scan entirely.
        //
        // Every one the pages import, the engine's two halves among them, which
        // Bryntime and Brycomp reach through their own folders. Named `svelte`
        // alone, the four others were found as the first pages were served,
        // and the server bundled them again and reloaded every page loading:
        // `markup.html`, which imports the compiler, came back empty on a
        // machine slow enough for its three tries to fall in that window.
        entries: [],
        include: ['svelte', 'svelte/compiler', 'esm-env/browser', 'bryntime > bryvend', 'brycomp > bryvend', 'brycomp > bryvend/compiler']
    },

    // The dev server watches the tree for the edits it reloads, and probes
    // archive thousands of files under `tests/scratch`, which no page serves:
    // watched, they ran the system out of file watchers (`ENOSPC`) and the
    // server died before the first edit. What it serves of the packages
    // Svelthon brings, the plugin says (`served`).
    server: {
        watch: { ignored: ['**/tests/scratch/**'] }
    },

    // The demo's pages, served under `/demo/`; the two pages at the root are
    // the browser check's probe and the bench.
    build: {
        rolldownOptions: {
            input: ['index', 'snippets', 'directives', 'instances', 'effects', 'django'].map((page) =>
                fileURLToPath(new URL(`./demo/${page}.html`, import.meta.url))
            )
        }
    },
    test: {
        environment: 'jsdom',

        // The engine, which Bryntime loads and starts before any test file, as
        // every way into Svelthon reaches it first; and the check of each
        // table of `test.for`.
        setupFiles: ['tests/engine-setup.js', 'tests/table-rows-setup.js'],

        // What sits in a folder of the scratch is kept, a copy of the tree among
        // it, and a copy is no test of this tree: it imports what is no longer
        // there. The probes beside them stay runnable by their own config.
        exclude: [...configDefaults.exclude, 'tests/scratch/*/**'],

        // **The clock is declared, the way the locale already is at every call.**
        // Every assertion that depends on a language passes one — `en-GB`,
        // `fr-FR`, `en-US` — so the suite does not care what the host speaks.
        // Nothing said what the host's zone was, and four tests read a different
        // day west of Greenwich: an environment a suite never declares is a
        // reading of the machine it happens to run on.
        //
        // UTC rather than the author's zone, so that a run here, a run in CI and
        // a run on a laptop in another country are one measurement. The tests
        // that are *about* the zone move it themselves, and carry a control that
        // proves the move took.
        env: { TZ: 'UTC' },

        // The first import of a chain of components compiles their Python,
        // which goes past the 5 s default.
        testTimeout: 30000,

        // Only what the project itself ships. Bryntime and its engine are not
        // ours to cover here, and would drown the number measured against.
        //
        // What this can and cannot see is worth knowing: it instruments the test
        // worker, so a module that runs inside Vite's own process — the
        // preprocessor and the plugin — counts only where a test calls it
        // directly. `markup.js` read 4 % while running for every file in the
        // project, until `tests/markup.test.js` called it in the open.
        //
        // Written when a test fails too: a run that failed said nothing of what
        // it had covered, and the report it was asked for was missing.
        coverage: {
            include: ['src/lib/**'],
            reporter: ['text', 'html'],
            reportOnFailure: true
        }
    }
});
