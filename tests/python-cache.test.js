// @vitest-environment node
//
// A compiled `.py` is kept on its date, since compiling Python is the
// expensive half and a store is served on every request in dev. A file Vite
// reports changed is compiled again whatever its date says: a copy or a tool
// that keeps `mtimeMs` left the cache serving the code it had before.
import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { svelthon } from '../src/lib/svelthon.js';

// The compiled module a file is served as: the wrapper names its virtual
// module, and loading that gives the code.
const served = (plugin, file) => {
    const wrapper = plugin.load.call({ addWatchFile() {} }, file);
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
