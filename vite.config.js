import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { python, svelthon } from './src/lib/svelthon.js';

export default defineConfig({
    plugins: [svelthon(), svelte({ preprocess: [python()] })],
    resolve: {
        alias: {
            'svelthon/runtime': fileURLToPath(new URL('./src/lib/runtime.js', import.meta.url))
        },
        conditions: ['browser']
    },
    test: {
        environment: 'jsdom'
    }
});
