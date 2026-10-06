// @vitest-environment node
//
// The preprocessor is handed the component's source, and it read the file on
// disk instead for the source map: a component handed over in memory under a
// name no file has was refused with `ENOENT`, and one whose disk copy differed
// ran the source it was handed under a map showing the other. The source the
// markup pass was handed travels with the call.
import { test, expect } from 'vitest';
import { preprocess } from 'svelte/compiler';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { python } from '../src/lib/svelthon.js';

const component = (count) => `<script lang="python">\ncount = ${count}\n</script>\n<p>{count}</p>`;

const generated = (code) => {
    const id = code.match(/from ["'](virtual:svelthon\/[^"']+)["']/)[1];

    return globalThis[Symbol.for('svelthon.generated')].get(`${process.cwd()}\n${id}`);
};

test('a component handed over in memory, under a name no file has, compiles', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'svelthon-'));

    try {
        const { code } = await preprocess(component(1), python(), { filename: join(dir, 'Absent.svelte') });

        expect(generated(code).code).toContain('count = 1');
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});

test('the source map shows the source handed over, not the one on disk', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'svelthon-'));
    const filename = join(dir, 'Differs.svelte');

    try {
        writeFileSync(filename, component(11));
        const { code } = await preprocess(component(22), python(), { filename });
        const module = generated(code);

        expect(module.code).toContain('count = 22');
        expect(module.map.sourcesContent).toEqual([component(22)]);
    } finally {
        rmSync(dir, { recursive: true, force: true });
    }
});
