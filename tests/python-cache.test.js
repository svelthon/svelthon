// @vitest-environment node
//
// A compiled `.py` is kept on what it holds, since compiling Python is the
// expensive half and a store is served on every request in dev. Kept on its
// date, a file a copy or a tool wrote again under the date it had was served
// as the code it held before: to a save Vite reported, and to a second build
// in the same process, which nothing reports.
import { test, expect } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { preprocess } from 'svelte/compiler';
import { python, svelthon } from '../src/lib/svelthon.js';

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

// Without HMR, as vitest serves a test's modules, Vite asks no `hotUpdate`: the
// body of a `.py` was the one first compiled, and a rerun ran the old Python.
test.for([['a .py', '.py'], ['a .svelte.py', '.svelte.py']])('%s edited is served as it now is by a server without HMR', async ([, extension]) => {
    const { createServer } = await import('vite');
    const room = mkdtempSync(join(tmpdir(), 'svelthon-cache-'));
    const file = join(room, `${room.split('/').pop().replace(/\W/g, '_')}${extension}`);
    const plugin = svelthon();
    const server = await createServer({
        configFile: false,
        root: room,
        plugins: [plugin],
        logLevel: 'silent',
        resolve: { alias: { 'svelthon/bridge': fileURLToPath(new URL('../src/lib/bridge.js', import.meta.url)) } },
        server: { middlewareMode: true, hmr: false },
        optimizeDeps: { noDiscovery: true, include: [] }
    });
    // The module as Python reaches it is loaded again, its file changed, and
    // names the body the graph then serves.
    const body = async () => {
        const wrapper = plugin.load.call({ addWatchFile() {} }, `${file}?python`);

        return (await server.environments.client.transformRequest(`\0${wrapper.match(/from "([^"]*virtual[^"]*)"/)[1]}`)).code;
    };

    try {
        writeFileSync(file, 'old_message = 1\n');
        expect(await body()).toContain('old_message');

        writeFileSync(file, 'new_message = 1\n');
        server.watcher.emit('change', file);

        expect(await body()).toContain('new_message');
    } finally {
        await server.close();
        rmSync(room, { recursive: true, force: true });
    }
});

// The body asked before the module after a save, as a page whose update was
// under way when a second save came asks for it: it was compiled from the file
// as it was last compiled, the save before, and stayed the body the graph
// served for every later save, until the server restarted. A module its import
// is found elsewhere for has the same body text and another prelude.
test.for([['a .py', '.py'], ['a .svelte.py', '.svelte.py']])('%s whose body is asked first after a save is served as it now is', async ([, extension]) => {
    const { createServer } = await import('vite');
    const room = mkdtempSync(join(tmpdir(), 'svelthon-cache-'));
    const stem = room.split('/').pop().replace(/\W/g, '_');
    const file = join(room, `${stem}${extension}`);
    const lib = join(room, 'lib');
    mkdirSync(lib);
    writeFileSync(join(lib, 'helper.py'), 'x = 1\n');
    const plugin = svelthon({ path: [lib] });
    const server = await createServer({
        configFile: false,
        root: room,
        plugins: [plugin],
        logLevel: 'silent',
        resolve: { alias: { 'svelthon/bridge': fileURLToPath(new URL('../src/lib/bridge.js', import.meta.url)) } },
        server: { middlewareMode: true, hmr: false },
        optimizeDeps: { noDiscovery: true, include: [] }
    });
    const body = (id) => server.environments.client.transformRequest(`\0${id}`).then((one) => one.code);

    try {
        writeFileSync(file, 'import helper\nold_message = 1\n');
        const id = plugin.load.call({ addWatchFile() {} }, `${file}?python`).match(/from "([^"]*virtual[^"]*)"/)[1];
        expect(await body(id)).toContain('old_message');

        for (const message of ['middle_message', 'new_message']) {
            writeFileSync(file, `import helper\n${message} = 1\n`);
            server.watcher.emit('change', file);
            expect(await body(id)).toContain(message);
        }

        // `helper` found beside it now, no longer on the path: the module's
        // own text is unchanged.
        expect(await body(id)).toContain('import "/lib/helper.py?');
        writeFileSync(join(room, 'helper.py'), 'x = 1\n');
        server.watcher.emit('change', file);
        expect(await body(id)).toContain('import "/helper.py?');
    } finally {
        await server.close();
        rmSync(room, { recursive: true, force: true });
    }
});

// A component's body, asked before its component after a save, by the page
// that runs the component compiled before: that component's body, the one its
// markup was compiled with. It was kept, and was the body of the component
// compiled next too, which asks the same number, until the next save.
test('a Python component whose body is asked first after a save is served the body of its next compile', async () => {
    const { createServer } = await import('vite');
    const room = mkdtempSync(join(tmpdir(), 'svelthon-cache-'));
    const file = join(room, `${room.split('/').pop().replace(/\W/g, '_')}.svelte`);
    const lib = join(room, 'lib');
    mkdirSync(lib);
    writeFileSync(join(lib, 'helper.py'), 'x = 1\n');
    const plugin = svelthon({ path: [lib] });
    const pre = python({ path: [lib] });
    // The saves told by the test alone, and when: a watcher's own report of a
    // write, coming in the middle of a request, forgets the body that request
    // is serving.
    const server = await createServer({
        configFile: false,
        root: room,
        plugins: [plugin],
        logLevel: 'silent',
        resolve: { alias: { 'svelthon/bridge': fileURLToPath(new URL('../src/lib/bridge.js', import.meta.url)) } },
        server: { middlewareMode: true, hmr: false, watch: null },
        optimizeDeps: { noDiscovery: true, include: [] }
    });
    const client = server.environments.client;
    const saved = (word) => {
        writeFileSync(file, `<script lang="python">\nimport helper\nlabel = "${word}"\n</script>\n\n<p>{label}</p>\n`);
        server.watcher.emit('change', file);
    };
    // The component compiled, as its transform does, and the body it imports.
    const compiled = async () => (await preprocess(readFileSync(file, 'utf8'), [pre], { filename: file })).code.match(/from "(virtual:[^"]*\?body=\d+)"/)[1];
    const body = async (id) => (await client.transformRequest(`\0${id}`)).code;
    const kept = (id) => client.moduleGraph.getModuleById(`\0${id}`)?.transformResult != null;

    try {
        saved('c_zero');
        const id = await compiled();
        expect([await body(id), kept(id)]).toEqual([expect.stringContaining('c_zero'), true]);

        saved('c_one');
        expect(await compiled()).toBe(id);
        expect([await body(id), kept(id)]).toEqual([expect.stringContaining('c_one'), true]);

        saved('c_two');
        expect([await body(id), kept(id)]).toEqual([expect.stringContaining('c_one'), false]);
        expect(await compiled()).toBe(id);
        expect([await body(id), kept(id)]).toEqual([expect.stringContaining('c_two'), true]);

        // `helper` found beside it now: the component's text is unchanged.
        expect(await body(id)).toContain('import "/lib/helper.py?');
        writeFileSync(join(room, 'helper.py'), 'x = 1\n');
        server.watcher.emit('change', file);
        expect([await body(id), kept(id)]).toEqual([expect.stringContaining('import "/lib/helper.py?'), false]);
        await compiled();
        expect([await body(id), kept(id)]).toEqual([expect.stringContaining('import "/helper.py?'), true]);
    } finally {
        await server.close();
        rmSync(room, { recursive: true, force: true });
    }
});

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
