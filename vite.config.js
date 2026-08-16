import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { python, svelthon, vendorQuirks } from './src/lib/svelthon.js';

export default defineConfig({
    plugins: [svelthon(), vendorQuirks(), svelte({ preprocess: [python()] })],
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
        environment: 'jsdom'
    }
});
