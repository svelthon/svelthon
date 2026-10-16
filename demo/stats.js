// The demo shows how many tests back the project. Hard-coding it means letting
// it drift on every addition, so it is counted when the module is served.
//
// The demo's own plugin, beside the page that reads it: the number is this
// project's, and the plugin the package ships has no business serving it to
// every project that uses it.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ID = 'virtual:demo/stats';

// The tests as the README counts them: a line that opens a `test(`, anchored,
// since a `/re/.test(x)` elsewhere in a file is not a test, and `test.fails()`,
// the failures we expect, is one.
const countTests = (root) => {
    const tests = resolve(root, 'tests');

    return readdirSync(tests)
        .filter((name) => name.endsWith('.test.js'))
        .reduce((total, name) => total + (readFileSync(resolve(tests, name), 'utf8').match(/^\s*test(\.fails)?\(/gm) || []).length, 0);
};

export function demoStats() {
    // The project, read as the plugin is made: what the process is in when it
    // later asks for the module may be another directory.
    const root = process.cwd();

    return {
        name: 'svelthon:demo-stats',
        resolveId: (specifier) => (specifier === ID ? '\0' + ID : undefined),
        load: (id) => (id === '\0' + ID ? `export const tests = ${countTests(root)};` : undefined),

        // The count is read from the filesystem once, and the module holding it
        // depends on no file Vite can see, so nothing would ever invalidate it,
        // and the page would keep showing a stale number.
        hotUpdate({ file, modules }) {
            if (!file.endsWith('.test.js')) return;

            const graph = this.environment.moduleGraph;
            const mod = graph.getModuleById('\0' + ID);

            if (!mod) return;
            graph.invalidateModule(mod);

            return [...modules, mod];
        }
    };
}
