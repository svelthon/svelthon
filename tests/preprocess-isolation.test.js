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
    const id = code.match(/virtual:svelthon\/[^"']+/)[0];
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

        // The two names are the same, which is what makes this a question at
        // all; what each body was compiled from tells them apart as well.
        expect(projects[0].code.match(/virtual:svelthon\/\w+/)[0]).toBe(
            projects[1].code.match(/virtual:svelthon\/\w+/)[0]
        );

        for (const { word, plugin, code, alone } of projects) {
            expect(alone).toContain(word);
            expect(served(plugin, code)).toBe(alone);
        }
    });
});

// The registries that refuse two files of one name held every project's claims
// under the name alone, as a path relative to the project that made it: B,
// holding a file at the path A claimed and never compiling it, was refused its
// own module, `both compile to …` or `both imported as …`. Each project claims
// its own names, as `generated` keeps its own modules; two files of one name in
// one project are still refused (`two .py of one stem in one project`).
describe('a claim of one project does not refuse another', () => {
    test('a module', () => {
        const original = process.cwd();
        const [first, second] = [join(temporary, 'claims-a'), join(temporary, 'claims-b')];

        for (const one of [join(first, 'src', 'lib'), join(second, 'src', 'lib'), join(second, 'lib')]) {
            mkdirSync(one, { recursive: true });
            writeFileSync(join(one, 'claimed_stem.py'), 'x = 1\n');
        }

        try {
            process.chdir(first);
            svelthon().load.call({ addWatchFile() {} }, join(first, 'src', 'lib', 'claimed_stem.py'));

            process.chdir(second);
            const plugin = svelthon();

            expect(() => plugin.load.call({ addWatchFile() {} }, join(second, 'lib', 'claimed_stem.py'))).not.toThrow();
        } finally {
            process.chdir(original);
        }
    });

    test('a component', async () => {
        const original = process.cwd();
        const [first, second] = [join(temporary, 'names-a'), join(temporary, 'names-b')];
        const source = '<script lang="python">\nword = "x"\n</script>\n<p>{word}</p>\n';

        for (const one of [join(first, 'src'), join(second, 'src', 'card')]) mkdirSync(one, { recursive: true });
        for (const file of [join(first, 'src', 'card-part.svelte'), join(second, 'src', 'card-part.svelte')]) {
            writeFileSync(file, source);
        }
        writeFileSync(join(second, 'src', 'card', 'part.svelte'), source);

        try {
            process.chdir(first);
            await preprocess(source, [python()], { filename: join(first, 'src', 'card-part.svelte') });

            process.chdir(second);
            const done = preprocess(source, [python()], { filename: join(second, 'src', 'card', 'part.svelte') });

            await expect(done).resolves.toBeDefined();
        } finally {
            process.chdir(original);
        }
    });
});

// One `.py` both projects import, reached by a different path from each: the
// module name is made of that path, and the compiled file was cached under the
// file alone, so the second project was handed a script importing the first
// project's module, which its plugin does not serve.
describe('one Python file shared by two projects', () => {
    // Each stem in projects of its own: `shared.py` and `shared.svelte.py` side
    // by side in one project are both imported as `shared`, and refused.
    test.for([['shared.py'], ['shared.svelte.py']])('%s is served to each under its own name', ([stem]) => {
        const original = process.cwd();
        const file = join(temporary, `common-${stem}`, stem);
        const loads = [];

        mkdirSync(join(temporary, `common-${stem}`), { recursive: true });
        writeFileSync(file, 'answer = 42\n');

        try {
            for (const root of [join(temporary, `one-${stem}`), join(temporary, `two-${stem}`, 'nested')]) {
                mkdirSync(root, { recursive: true });
                process.chdir(root);

                const plugin = svelthon();
                const script = plugin.load.call({ addWatchFile() {} }, `${file}?python`);
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
            const id = code.match(/virtual:svelthon\/[^"']+/)[0];

            writeFileSync(first.filename, first.source.replace('<p>', '<p>edited '));
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
            const id = String(plugin.load.call({ addWatchFile() {} }, `${file}?python`)).match(/virtual:svelthon\/\w+/)[0];

            if (moved) process.chdir(second.root);
            const environment = graph();
            plugin.hotUpdate.call({ environment }, { file, modules: [] });

            expect(environment.invalidated).toContain('\0' + id);
        } finally {
            process.chdir(original);
        }
    });
});

// A relative path the package reads is the project's, not the directory's the
// process is in when it reads it. Four of them asked the directory of the
// moment without naming it: the search path, `python({ path: ['src/lib'] })` as
// the README writes it, and the plugin's own; the directory of a component
// handed over without a file; the first claimant of a Python name; and the
// demo's `tests/`. After a change of directory a component of A ran B's
// Python, without an error. Witness: the same work without the change.
describe('a relative path is the project’s, whatever the process is in', () => {
    const project = (name, answer) => {
        const root = join(temporary, name);

        mkdirSync(join(root, 'src', 'lib'), { recursive: true });
        mkdirSync(join(root, 'src', 'routes'), { recursive: true });
        writeFileSync(join(root, 'src', 'lib', 'peps.py'), `__all__ = ["answer"]\nanswer = ${answer}\n`);
        writeFileSync(join(root, 'peps.py'), `__all__ = ["answer"]\nanswer = ${answer}\n`);
        writeFileSync(join(root, 'src', 'routes', 'data.py'), 'import peps\n__all__ = ["peps"]\n');
        return root;
    };
    // The module as Python reaches it, its body left to the import statement.
    const imported = (body) => body.match(/import "([^"]*peps\.py)\?python"/)?.[1];
    const source = '<script lang="python">\nimport peps\n</script>\n<p>{peps.answer}</p>\n';

    test.for([[false], [true]])('the preprocessor’s search path, moved: %s', async ([moved]) => {
        const original = process.cwd();
        const [first, second] = [project(`path-a-${moved}`, 1), project(`path-b-${moved}`, 2)];
        const filename = join(first, 'src', 'routes', 'Page.svelte');

        writeFileSync(filename, source);

        try {
            process.chdir(first);
            const plugin = svelthon();
            const pre = python({ path: ['src/lib'] });

            if (moved) process.chdir(second);
            const { code } = await preprocess(source, [pre], { filename });

            expect(imported(served(plugin, code))).toBe(join(first, 'src', 'lib', 'peps.py'));
        } finally {
            process.chdir(original);
        }
    });

    test.for([[false], [true]])('the plugin’s search path, moved: %s', ([moved]) => {
        const original = process.cwd();
        const [first, second] = [project(`plugin-path-a-${moved}`, 1), project(`plugin-path-b-${moved}`, 2)];

        try {
            process.chdir(first);
            const plugin = svelthon({ path: ['src/lib'] });

            if (moved) process.chdir(second);
            const script = plugin.load.call({ addWatchFile() {} }, `${join(first, 'src', 'routes', 'data.py')}?python`);
            const id = String(script).match(/virtual:svelthon\/\w+/)[0];

            expect(imported(plugin.load('\0' + id).code)).toBe(join(first, 'src', 'lib', 'peps.py'));
        } finally {
            process.chdir(original);
        }
    });

    test.for([[false], [true]])('a component without a file, moved: %s', async ([moved]) => {
        const original = process.cwd();
        const [first, second] = [project(`nofile-a-${moved}`, 1), project(`nofile-b-${moved}`, 2)];

        try {
            process.chdir(first);
            const plugin = svelthon();
            const pre = python();

            if (moved) process.chdir(second);
            const { code } = await preprocess(source, [pre]);

            expect(code).toContain('virtual:svelthon/Component');
            expect(imported(served(plugin, code))).toBe(join(first, 'peps.py'));
        } finally {
            process.chdir(original);
        }
    });

    test.for([[false], [true]])('two .py of one stem in one project, moved: %s', ([moved]) => {
        const original = process.cwd();
        const first = join(temporary, `claim-a-${moved}`);
        const stem = `conf_${moved}`;

        for (const directory of ['a', 'b']) {
            mkdirSync(join(first, directory), { recursive: true });
            writeFileSync(join(first, directory, `${stem}.py`), 'x = 1\n');
        }

        try {
            process.chdir(first);
            const plugin = svelthon();
            plugin.load.call({ addWatchFile() {} }, join(first, 'a', `${stem}.py`));

            if (moved) process.chdir(temporary);
            expect(() => plugin.load.call({ addWatchFile() {} }, join(first, 'b', `${stem}.py`))).toThrow(
                `are both imported as \`${stem}\``
            );
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

        // The Python block's; the `<script module>` that announces the
        // component is JavaScript, which the hook leaves alone.
        pre.script = (args) => {
            const out = script(args);
            if (out !== undefined) modules.push({ alpha: args.content.includes('alpha'), body: served(plugin, out.code) });
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
