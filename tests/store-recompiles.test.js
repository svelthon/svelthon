// @vitest-environment node
//
// A `.py` is compiled once and kept, keyed on the file's mtime, because
// compiling Python is the expensive half of serving a store in dev.
//
// Nothing checked that the key *works*. A mutation sweep said so: invert the
// comparison and the cache is returned exactly when the file has changed and
// recomputed when it has not — an edit would never reach the page — and the
// suite stayed green, because no test in it edits a `.py` on disk and asks
// again. `scripts/hmr-check.sh` does, from outside, through a dev server.
//
// Reached through the plugin's own `load`, not by exporting the cache: the
// question is what a second request for the same id answers.
import { test, expect, describe, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { svelthon } from '../src/lib/svelthon.js';

const made = [];

afterEach(() => {
    while (made.length) rmSync(made.pop(), { recursive: true, force: true });
});

const room = () => {
    const at = mkdtempSync(join(tmpdir(), 'svelthon-store-'));
    made.push(at);

    return at;
};

// mtime has a resolution, and two writes inside one tick can share a stamp. The
// stamp is moved explicitly so the test measures the rule and not the clock.
const write = (file, text, seconds) => {
    writeFileSync(file, text);
    utimesSync(file, seconds, seconds);
};

describe('a .py served twice', () => {
    // `load` runs as a Rollup plugin, so it is given the one hook it reaches
    // for: the watcher a `.py` import registers itself with.
    //
    // And what comes back for the file is a **wrapper**, the same text whatever
    // the Python says: the compiled body lives in the virtual module the
    // wrapper imports. So the wrapper is read for that id and the id is served
    // in turn, which is the pair Vite itself asks for.
    const served = (plugin, file) => {
        const rollup = { addWatchFile: () => {} };
        const wrapper = plugin.load.call(rollup, file);
        const id = (typeof wrapper === 'string' ? wrapper : wrapper.code).match(
            /from "([^"]*virtual[^"]*)"/
        )[1];
        const out = plugin.load.call(rollup, `\0${id}`);

        return typeof out === 'string' ? out : out.code;
    };

    test('is compiled once while the file has not changed', () => {
        const file = join(room(), 'counter.py');
        write(file, 'total = 1\n', 1000);

        const plugin = svelthon();

        expect(served(plugin, file)).toBe(served(plugin, file));
    });

    test('and again once it has, which is what the stamp is for', () => {
        const file = join(room(), 'counter.py');
        write(file, 'total = 1\n', 1000);

        const plugin = svelthon();
        const first = served(plugin, file);

        write(file, 'total = 2\n', 2000);

        const second = served(plugin, file);

        expect(second).not.toBe(first);
        expect(second).toContain('2');
    });
});
