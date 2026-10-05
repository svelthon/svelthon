// @vitest-environment node
//
// What one preprocessing of a component works out must reach that component
// and no other. Two ways it did not:
//
// - Two projects built in one process, each with a `src/Card.svelte`, give the
//   same virtual id, and the generated modules sat on one global map under the
//   id alone: the first project's plugin served the second project's Python.
// - Two calls of `preprocess()` on two versions of one file, at once, run both
//   `markup` hooks before either `script` hook, and what the first hook found
//   was kept under the filename: the first version was compiled with the second
//   one's expressions, reading a name it does not declare.
//
// The witness each time is the same work done one at a time, which is what
// every other test does.
import { test, expect, describe, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { preprocess } from 'svelte/compiler';

import { python, svelthon } from '../src/lib/svelthon.js';

const temporary = mkdtempSync(join(tmpdir(), 'svelthon-isolation-'));
afterAll(() => rmSync(temporary, { recursive: true, force: true }));

const served = (plugin, code) => {
    const id = code.match(/virtual:svelthon\/\w+/)[0];
    const loaded = plugin.load('\0' + id);

    return typeof loaded === 'string' ? loaded : loaded?.code;
};

describe('two projects in one process', () => {
    test('each plugin serves its own project’s module', async () => {
        const original = process.cwd();
        const projects = [];

        try {
            for (const word of ['FIRST_PROJECT', 'SECOND_PROJECT']) {
                const root = join(temporary, word);
                const filename = join(root, 'src', 'Card.svelte');
                const source = `<script lang="python">\nword = "${word}"\n</script>\n<p>{word}</p>\n`;

                mkdirSync(join(root, 'src'), { recursive: true });
                writeFileSync(filename, source);
                process.chdir(root);

                const plugin = svelthon();
                const { code } = await preprocess(source, [python()], { filename });

                // The witness: what the plugin serves before the other project
                // has been built.
                projects.push({ word, plugin, code, alone: served(plugin, code) });
            }
        } finally {
            process.chdir(original);
        }

        // The two ids are the same, which is what makes this a question at all.
        expect(projects[0].code.match(/virtual:svelthon\/\w+/)[0]).toBe(
            projects[1].code.match(/virtual:svelthon\/\w+/)[0]
        );

        for (const { word, plugin, code, alone } of projects) {
            expect(alone).toContain(word);
            expect(served(plugin, code)).toBe(alone);
        }
    });
});

// One `.py` both projects import, reached by a different path from each: the
// module name is made of that path, and the compiled file was cached under the
// file alone, so the second project was handed a script importing the first
// project's module, which its plugin does not serve.
describe('one Python file shared by two projects', () => {
    test.for([['shared.py'], ['shared.svelte.py']])('%s is served to each under its own name', ([stem]) => {
        const original = process.cwd();
        const file = join(temporary, 'common', stem);
        const loads = [];

        mkdirSync(join(temporary, 'common'), { recursive: true });
        writeFileSync(file, 'answer = 42\n');

        try {
            for (const root of [join(temporary, 'one'), join(temporary, 'two', 'nested')]) {
                mkdirSync(root, { recursive: true });
                process.chdir(root);

                const plugin = svelthon();
                const script = plugin.load.call({ addWatchFile() {} }, file);
                const id = script.match(/from "(virtual:svelthon\/\w+)"/)[1];

                loads.push({ id, module: plugin.load('\0' + id) });
            }
        } finally {
            process.chdir(original);
        }

        expect(loads[0].id).not.toBe(loads[1].id);
        for (const { module } of loads) expect(module?.code).toContain('answer');
    });
});

// A route entry SvelteKit hands over, `/src/routes/+page.server.py`, was
// resolved against the directory the process was in when it was asked, while
// the plugin's modules belong to the project it was made in: after a change of
// directory, the plugin returned another project's route, or a file that does
// not exist. And the preprocessor filed its modules under the directory of the
// moment too. Each half now keeps the project it was made in, and a route is
// rooted where Vite roots it once Vite has said.
describe('each half keeps its own project', () => {
    const route = '/src/routes/+page.server.py';
    const project = (name, answer) => {
        const root = join(temporary, name);

        mkdirSync(join(root, 'src', 'routes'), { recursive: true });
        writeFileSync(join(root, 'src', 'routes', '+page.server.py'), `__all__ = ["answer"]\nanswer = ${answer}\n`);
        return root;
    };

    test('a route is resolved in the plugin’s project, whatever the process is in', () => {
        const original = process.cwd();
        const [first, second] = [project('route-a', 1), project('route-b', 2)];

        try {
            process.chdir(first);
            const plugin = svelthon();
            const alone = plugin.resolveId(route);

            process.chdir(second);
            const moved = plugin.resolveId(route);

            process.chdir(original);
            expect([alone, moved, plugin.resolveId(route)]).toEqual(Array(3).fill(join(first, route)));
        } finally {
            process.chdir(original);
        }
    });

    test('and in the root a real Vite server resolves', async () => {
        const { createServer } = await import('vite');
        const original = process.cwd();
        const [first, second] = [project('vite-a', 1), project('vite-b', 2)];
        const plugin = svelthon();
        const server = await createServer({
            configFile: false,
            root: first,
            plugins: [plugin],
            logLevel: 'silent',
            server: { middlewareMode: true },
            optimizeDeps: { noDiscovery: true, include: [] }
        });

        try {
            process.chdir(second);
            const resolved = await server.environments.client.pluginContainer.resolveId(route);

            expect(resolved?.id).toBe(join(first, route));
        } finally {
            process.chdir(original);
            await server.close();
        }
    });

    test('a component preprocessed after a change of directory is served by its project’s plugin', async () => {
        const original = process.cwd();
        const first = join(temporary, 'files-a');
        const filename = join(first, 'src', 'Card.svelte');
        const source = '<script lang="python">\nword = "MOVED"\n</script>\n<p>{word}</p>\n';

        mkdirSync(join(first, 'src'), { recursive: true });
        writeFileSync(filename, source);

        try {
            process.chdir(first);
            const plugin = svelthon();
            const pre = python();

            process.chdir(temporary);
            const { code } = await preprocess(source, [pre], { filename });

            expect(served(plugin, code)).toContain('MOVED');
        } finally {
            process.chdir(original);
        }
    });
});

// And a module's name was read from the directory of the moment: after a change
// of directory, editing a file of the plugin's project invalidated nothing, and
// the page went on serving the Python it had. The name is read from the
// project of the half that asks, as the key it is filed under. Witness: the same
// edit without the change of directory.
describe('an edit reaches its module, whatever the process is in', () => {
    const graph = () => {
        const invalidated = [];

        return {
            invalidated,
            moduleGraph: { getModuleById: (id) => ({ id }), invalidateModule: (mod) => invalidated.push(mod.id) }
        };
    };
    const project = (name) => {
        const root = join(temporary, name);
        const filename = join(root, 'src', 'Card.svelte');
        const source = `<script lang="python">\nword = "${name}"\n</script>\n<p>{word}</p>\n`;

        mkdirSync(join(root, 'src'), { recursive: true });
        writeFileSync(filename, source);
        writeFileSync(join(root, 'src', 'store.py'), `__all__ = ["n"]\nn = 1\n`);
        return { root, filename, source };
    };

    test.for([[false], [true]])('a component, moved: %s', async ([moved]) => {
        const original = process.cwd();
        const [first, second] = [project(`edit-a-${moved}`), project(`edit-b-${moved}`)];

        try {
            process.chdir(first.root);
            const plugin = svelthon();
            const { code } = await preprocess(first.source, [python()], { filename: first.filename });
            const id = code.match(/virtual:svelthon\/\w+/)[0];

            if (moved) process.chdir(second.root);
            const environment = graph();
            plugin.hotUpdate.call({ environment }, { file: first.filename, modules: [] });

            expect(environment.invalidated).toContain('\0' + id);
        } finally {
            process.chdir(original);
        }
    });

    test.for([[false], [true]])('a .py, moved: %s', ([moved]) => {
        const original = process.cwd();
        const [first, second] = [project(`store-a-${moved}`), project(`store-b-${moved}`)];
        const file = join(first.root, 'src', 'store.py');

        try {
            process.chdir(first.root);
            const plugin = svelthon();
            const id = String(plugin.load.call({ addWatchFile() {} }, file)).match(/virtual:svelthon\/\w+/)[0];

            if (moved) process.chdir(second.root);
            const environment = graph();
            plugin.hotUpdate.call({ environment }, { file, modules: [] });

            expect(environment.invalidated).toContain('\0' + id);
        } finally {
            process.chdir(original);
        }
    });
});

describe('two versions of one file preprocessed at once', () => {
    const filename = join(temporary, 'Same.svelte');
    const first = '<script lang="python">\nalpha = 1\n</script>\n<p>{alpha + 1}</p>\n';
    const second = '<script lang="python">\nbeta = 2\n</script>\n<p>{beta * 3}</p><p>{beta + 4}</p>\n';

    // Each version's component and the module its `script` hook filed, read at
    // the moment that hook returns, which is when Vite would ask for it.
    const run = async (together) => {
        writeFileSync(filename, first);

        const pre = python();
        const plugin = svelthon();
        const modules = [];
        const script = pre.script;

        pre.script = (args) => {
            const out = script(args);
            modules.push({ alpha: args.content.includes('alpha'), body: served(plugin, out.code) });
            return out;
        };

        const versions = together
            ? await Promise.all([first, second].map((one) => preprocess(one, [pre], { filename })))
            : [await preprocess(first, [pre], { filename }), await preprocess(second, [pre], { filename })];

        return {
            components: versions.map((one) => one.code),
            modules: [true, false].map((alpha) => modules.find((one) => one.alpha === alpha).body)
        };
    };

    test('give each version what it gives alone', async () => {
        const alone = await run(false);
        const together = await run(true);

        // The witness reads the first version's own name, and only it.
        expect(alone.modules[0]).toContain("'alpha'");
        expect(alone.modules[0]).not.toContain("'beta'");

        expect(together.components).toEqual(alone.components);
        expect(together.modules).toEqual(alone.modules);
    });
});
