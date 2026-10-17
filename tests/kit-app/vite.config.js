// The SvelteKit application `npm run test:kit` builds with adapter-node and
// serves: a page, a route module and a remote function, all in Python. Nothing
// in `npm test` builds, so this is where an order a bundler gives the engine, a
// module SvelteKit refuses at build or a page that answers 500 shows.
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { svelthon, python } from '../../src/lib/svelthon.js';

const at = (path) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    plugins: [
        svelthon(),
        sveltekit({
            preprocess: [python({ path: [at('./src/lib')] })],
            // What makes the router see `+page.server.py` and `.remote.py`.
            moduleExtensions: ['.js', '.ts', '.py'],
            // Read at build: a remote command is refused unless its `Origin`
            // is this one.
            paths: { origin: process.env.ORIGIN ?? 'http://localhost:5196' },
            experimental: {
                compileModule: { extensions: ['.js', '.ts', '.py'] },
                remoteFunctions: true
            },
            adapter: adapter()
        })
    ],
    resolve: {
        alias: {
            'svelthon/runtime': at('../../src/lib/runtime.js'),
            'svelthon/compile': at('../../src/lib/compile.cjs')
        }
    },
    // Vite's dependency scanner hands the Python of a component to a
    // JavaScript parser; the bare imports worth pre-bundling are named, the
    // compiler among them, which is CommonJS.
    optimizeDeps: { entries: [], include: ['svelte', 'svelthon/compile'] }
});
