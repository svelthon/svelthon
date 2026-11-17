// @vitest-environment node
//
// The server's half of SvelteKit's transport for Python: what the browser
// sends, a remote function's argument, is decoded restricted, values alone,
// since rebuilding a class or calling a function it names would run code on the
// server; a module SvelteKit keeps out of the browser says so as it runs; and
// the plugin installs the transport where SvelteKit starts it.
import { test, expect } from 'vitest';
import * as devalue from 'devalue';
import { transport } from '../src/lib/transport.js';
import { signed } from '../src/lib/transport-server.js';
import { __pybridge, pyBind } from '../src/lib/bridge.js';
import { compile } from '../src/lib/compile.js';
import { svelthon } from '../src/lib/svelthon.js';
import { values, describe } from './fixtures/transport_data.py';

const $B = globalThis.__BRYTHON__;
const { encode, decode } = transport.svelthon;
const sent = (key) => devalue.stringify({ value: __pybridge.bound($B.$getitem(pyBind(values()), key)) }, { svelthon: encode });

test('values the browser sent are read as the values they are', () => {
    const value = devalue.parse(sent('tuple'), { svelthon: decode }).value;

    expect(String(describe(pyBind(value)))).toBe('tuple:(1, (2, 3))');
});

test('a class the browser sent is refused: rebuilding it would run code on the server', () => {
    expect(() => devalue.parse(sent('point'), { svelthon: decode })).toThrow(/cannot name a class or a function/);
});

// What a remote function prerenders, SvelteKit reads back on the server from
// the site's address: signed by the build's key, it is rebuilt in full; under
// another key's signature or none, it is a value the browser could have sent.
test('what the server signed while it built, it reads back in full; anything else, values alone', () => {
    const view = (key) => __pybridge.bound($B.$getitem(pyBind(values()), key));
    const building = signed(transport, 'a'.repeat(64), () => true, () => true).svelthon;
    const made = devalue.stringify({ value: view('point') }, { svelthon: building.encode });

    expect(String(describe(pyBind(devalue.parse(made, { svelthon: building.decode }).value)))).toBe('Point:Point(3)');

    // Another key's signature, none, or the right one replayed as a remote
    // function's argument, which the browser sent.
    const replayed = signed(transport, 'a'.repeat(64), () => true, () => false).svelthon.decode;

    for (const other of [signed(transport, 'b'.repeat(64), () => true, () => true).svelthon.decode, decode, replayed]) {
        expect(() => devalue.parse(made, { svelthon: other })).toThrow(/cannot name a class or a function/);
    }

    // Signed only while it builds, and only what names a class or a function.
    expect(building.encode(view('point'))[0]).toBe('k');
    expect(building.encode(view('tuple'))[0]).not.toBe('k');
    expect(signed(transport, 'a'.repeat(64), () => false, () => true).svelthon.encode(view('point'))[0]).not.toBe('k');
});

test('a module SvelteKit keeps out of the browser says so as it runs', () => {
    const text = (source) => JSON.stringify(compile('x = 1\n', 'x', source, { plain: true }));

    expect(text('src/lib/server/vault.py')).toContain('serverModule');
    expect(text('src/lib/vault.server.py')).toContain('serverModule');
    expect(text('src/routes/+page.server.py')).toContain('serverModule');
    expect(text('src/lib/models.py')).not.toContain('serverModule');
    expect(text('src/routes/server/+page.py')).not.toContain('serverModule');
});

// And learns the application's own there, which a container of JavaScript's
// among Python values crosses through.
test('the plugin installs the transport where SvelteKit starts it', () => {
    const plugin = svelthon();
    const manifest = ['export const hooks = {', '\ttransport: universal_hooks.transport || {}', '};', 'export const decoders = {};'].join('\n');
    const patched = plugin.transform(`${manifest}\n`, '/app/.svelte-kit/generated/client/app.js');

    expect(patched).toContain('transport: __svelthon_application({ ...__svelthon_transport, ...(universal_hooks.transport || {}) })');
    expect(plugin.transform('export const x = 1;', '/app/src/x.js')).toBeUndefined();
    expect(plugin.load('\0svelthon-transport?/kit/transport.js')).toContain('__kit({ ...__svelthon, ...transport })');
    expect(plugin.load('\0svelthon-transport-server?/kit/transport.js')).toContain('__application(transport); __kit({ ...__python, ...transport })');
});

test("the key that signs is the server's code alone, never the browser's", async () => {
    const plugin = svelthon();
    const asked = (name) =>
        plugin.resolveId.call({ environment: { name }, resolve: async () => ({ id: '/kit/transport.js' }) }, '#app/internal/transport', '/x.js');
    const [server, client] = [await asked('ssr'), await asked('client')];

    expect(plugin.load(server)).toMatch(/__signed\(__svelthon, "[0-9a-f]{64}"/);
    expect(plugin.load(client)).not.toMatch(/signed|[0-9a-f]{64}/);
    // The request is read through SvelteKit's public API, never a module of
    // its own that a minor version may change.
    expect(plugin.load(server)).toContain("import { getRequestEvent as __event } from '$app/server';");
    expect(plugin.load(server)).not.toContain('@sveltejs/kit/internal');
});

// A `.remote.py` declares its functions with SvelteKit's own, each taking the
// Python function through the bridge's relay; any other module imports
// SvelteKit's `$app/server` as it is.
test("a remote module's functions hand SvelteKit what the browser reads", async () => {
    const plugin = svelthon();
    const asked = (importer) => plugin.resolveId.call({ environment: { name: 'ssr' }, resolve: async () => ({ id: '/kit/server.js' }) }, '$app/server', importer);
    const code = plugin.load(await asked('/app/src/lib/greet.remote.py'));

    expect(await asked('/app/src/lib/other.js')).toBeUndefined();
    expect(code).toContain('export * from "/kit/server.js";');
    for (const name of ['query', 'command', 'form', 'prerender']) expect(code).toContain(`export const ${name} = __remote(__${name}, __inRemote);`);
    expect(code).toContain('return __event().isRemoteRequest === true;');
});
