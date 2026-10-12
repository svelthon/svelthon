import { defineConfig, configDefaults } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { python, svelthon, compileOptionsFor } from './src/lib/svelthon.js';

export default defineConfig({
    plugins: [svelthon(), svelte({
            preprocess: [python({ path: ['demo'] })],
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
            'svelthon/runtime': fileURLToPath(new URL('./src/lib/runtime.js', import.meta.url))
        },
        conditions: ['browser']
    },

    optimizeDeps: {
        // Vite's dependency scanner runs ahead of the plugin pipeline: it reads
        // the HTML entries, finds `<script lang="python">` and hands the Python
        // to a JavaScript parser, then fails on `./store.py` because no file of
        // that name is meant to be loaded directly. Its only job here is to
        // discover bare imports, and this project has exactly one worth
        // pre-bundling, so we name it and skip the scan entirely.
        entries: [],
        include: ['svelte']
    },

    // The dev server watches the tree for the edits it reloads, and an audit
    // archives thousands of files under `tests/scratch`, which no page serves:
    // watched, they ran the system out of file watchers (`ENOSPC`) and the
    // server died before the first edit.
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

        // An audit keeps a copy of the tests it ran beside its evidence, and a
        // copy is no test of this tree: it imports what is no longer there.
        exclude: [...configDefaults.exclude, 'tests/scratch/*-evidence/**'],

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

        // Only what the project itself ships. The vendored Brython is not ours
        // to cover, and it would drown the number it is measured against.
        //
        // What this can and cannot see is worth knowing: it instruments the test
        // worker, so a module that runs inside Vite's own process — the
        // preprocessor and the plugin — counts only where a test calls it
        // directly. `markup.js` read 4 % while running for every file in the
        // project, until `tests/markup.test.js` called it in the open.
        coverage: {
            include: ['src/lib/**'],
            reporter: ['text', 'html']
        }
    }
});
