// @vitest-environment node
//
// The demo shows how many tests back the project. Hard-coding it means letting
// it drift on every addition, so it is counted when the module is served, by the
// demo's own plugin: the plugin the package ships serves every project, and the
// number is this one's.
import { test, expect } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { demoStats } from '../demo/stats.js';

const ID = '\0virtual:demo/stats';

test('the test count is served, a number and not zero', () => {
    const count = Number(demoStats().load(ID).match(/= (\d+);/)[1]);

    expect(count).toBeGreaterThan(400);
});

// The project the plugin was made in, not the directory the process is in when
// it asks.
test('the demo counts the tests of its project', () => {
    const original = process.cwd();
    const temporary = mkdtempSync(join(tmpdir(), 'svelthon-stats-'));
    const plugin = demoStats();
    const alone = plugin.load(ID);

    try {
        process.chdir(temporary);

        expect(plugin.load(ID)).toBe(alone);
    } finally {
        process.chdir(original);
        rmSync(temporary, { recursive: true, force: true });
    }
});

// The count is read from the filesystem once, and the module holding it depends
// on no file Vite can see.
test('adding a test forgets the count', () => {
    const invalidated = [];
    const environment = {
        moduleGraph: {
            getModuleById: (id) => ({ id }),
            invalidateModule: (mod) => invalidated.push(mod.id)
        }
    };
    const out = demoStats().hotUpdate.call(
        { environment },
        { file: resolve(process.cwd(), 'tests/markup.test.js'), modules: [] }
    );

    expect(invalidated).toEqual([ID]);
    expect(out).toHaveLength(1);
});
