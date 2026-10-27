// @vitest-environment node
//
// A compiled `.py` is kept on what it holds, since compiling Python is the
// expensive half and a store is served on every request in dev. Kept on its
// date, a file a copy or a tool wrote again under the date it had was served
// as the code it held before: to a save Vite reported, and to a second build
// in the same process, which nothing reports.
import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { svelthon } from '../src/lib/svelthon.js';

// The compiled module a file is served as: the wrapper, the module as Python
// reaches it, names its virtual module, and loading that gives the code.
const served = (plugin, file) => {
    const wrapper = plugin.load.call({ addWatchFile() {} }, `${file}?python`);
    const id = wrapper.match(/from "([^"]*virtual[^"]*)"/)[1];
    const out = plugin.load.call({}, `\0${id}`);

    return out.code ?? out;
};

const graph = { getModuleById: (id) => ({ id }), invalidateModule() {} };

test.for([['a .py', '.py'], ['a .svelte.py', '.svelte.py']])(
    '%s edited under the same date is compiled again once Vite reports it',
    ([, extension]) => {
        const room = mkdtempSync(join(tmpdir(), 'svelthon-cache-'));
        const file = join(room, `${room.split('/').pop().replace(/\W/g, '_')}${extension}`);

        try {
            const plugin = svelthon();

            writeFileSync(file, 'total = 1\n');
            utimesSync(file, 1000, 1000);
            const before = served(plugin, file);

            // Unchanged, the cache answers.
            expect(served(plugin, file)).toBe(before);

            writeFileSync(file, 'total = 2\n');
            utimesSync(file, 1000, 1000);
            plugin.hotUpdate.call({ environment: { moduleGraph: graph } }, { file, modules: [] });

            expect(served(plugin, file)).not.toBe(before);
        } finally {
            rmSync(room, { recursive: true, force: true });
        }
    }
);

test.for([['a .py', '.py'], ['a .svelte.py', '.svelte.py']])(
    '%s rewritten under the same date is compiled again by a second build of the process',
    ([, extension]) => {
        const room = mkdtempSync(join(tmpdir(), 'svelthon-cache-'));
        const file = join(room, `${room.split('/').pop().replace(/\W/g, '_')}${extension}`);

        try {
            writeFileSync(file, 'old_message = 1\n');
            utimesSync(file, 1000, 1000);
            const before = served(svelthon(), file);

            writeFileSync(file, 'new_message = 1\n');
            utimesSync(file, 1000, 1000);
            const after = served(svelthon(), file);

            expect([before.includes('old_message'), after.includes('new_message'), after.includes('old_message')]).toEqual([
                true,
                true,
                false
            ]);
        } finally {
            rmSync(room, { recursive: true, force: true });
        }
    }
);
