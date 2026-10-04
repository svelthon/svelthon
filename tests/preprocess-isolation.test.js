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
