// The SvelteKit application `npm run test:kit` lays out where the package
// manager installed Bryntime and Brylters under Svelthon alone, as pnpm does:
// Node finds neither by its name from here. Svelthon is the package installed.
import { sveltekit } from '@sveltejs/kit/vite';
import adapter from '@sveltejs/adapter-node';
import { defineConfig } from 'vite';
import { svelthon, python } from 'svelthon';

export default defineConfig({
    plugins: [sveltekit({ preprocess: [python()], adapter: adapter() }), svelthon()],
    optimizeDeps: { entries: [] }
});
