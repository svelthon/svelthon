import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { python, svelthon } from './src/lib/svelthon.js';

export default defineConfig({
    plugins: [svelthon(), svelte({
            preprocess: [python({ path: ['src'] })],
            // Le filtre de modules de vite-plugin-svelte, élargi au Python : un
            // `.svelte.py` est compilé comme un `.svelte.ts`, sous son propre nom.
            experimental: { compileModule: { extensions: ['.js', '.ts', '.py'] } }
        })],
    resolve: {
        alias: {
            'svelthon/runtime': fileURLToPath(new URL('./src/lib/runtime.js', import.meta.url))
        },
        conditions: ['browser']
    },
    // 5173 est pris par TABLE.
    server: { port: 5174, strictPort: true },

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

        // Chaque worker recharge et retransforme pour son compte le runtime
        // Brython — 1,4 Mo — puis reboote l'interpréteur. Paralléliser les
        // fichiers multiplie ce coût au lieu de le partager : mesuré à plus de
        // 30 minutes en parallèle contre moins de 2 en séquentiel.
        fileParallelism: false,
        pool: 'threads',
        poolOptions: { threads: { singleThread: true } },

        // The first import of a chain of components compiles their Python;
        // on a modest machine that goes well past the 5 s default.
        testTimeout: 30000
    }
});
