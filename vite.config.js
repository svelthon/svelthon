import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { python, svelthon } from './src/lib/svelthon.js';

export default defineConfig({
    plugins: [svelthon(), svelte({
            preprocess: [python({ path: ['src'] })],
            // vite-plugin-svelte's module filter, widened to Python: a
            // `.svelte.py` compiles as a `.svelte.ts` does, under its own name.
            experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
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
    test: {
        environment: 'jsdom',


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
