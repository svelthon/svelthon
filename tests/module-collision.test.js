// @vitest-environment node
//
// Python imports a module by its name, and a file's name is its stem. So
// `a/config.py` and `b/config.py` are both `config`, `$B.imported` holds one
// entry per name, and every `import config` in the project would read whichever
// loaded last, wherever it sat.
//
// Refused rather than made unique, and refused by the plugin, which sees the
// disk: a first claimant that is gone is a rename, not a second file. A stem no
// `import` can write is never claimed, and SvelteKit gives every route of a kind
// the same one.
import { test, expect, describe } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { nameFor as claimIn } from '../src/lib/svelthon.js';

// The project these paths are written from, the directory the suite runs in.
const nameFor = (filename) => claimIn(filename, process.cwd());

describe('two Python modules of one name', () => {
    test('the second is refused, and both files are named', () => {
        nameFor('tests/fixtures/collide/config.py');

        expect(() => nameFor('tests/fixtures/collide_again/config.py')).toThrow(
            /`tests\/fixtures\/collide_again\/config\.py` and `tests\/fixtures\/collide\/config\.py` are both imported as `config`.*Rename one of them/
        );
    });

    // A name is what Python says one is: `import ℘oids` is written, so the
    // stem is claimed like any other.
    test('a stem Python takes and letters alone do not is claimed too', () => {
        nameFor('tests/fixtures/collide/℘oids.py');

        expect(() => nameFor('tests/fixtures/collide_again/℘oids.py')).toThrow(/both imported as `℘oids`/);
    });

    // Paths nothing has on disk: the first claimant is gone, which is what a
    // file moved under a running dev server looks like.
    test('a first claimant that is gone is a rename, not a collision', () => {
        nameFor('tests/fixtures/gone/panier.svelte.py');

        expect(() => nameFor('tests/fixtures/moved/panier.svelte.py')).not.toThrow();
    });

    // Nor is one that no longer compiles to the name, under a running dev
    // server: a module a directory replaced, beside another file of its name.
    test('a first claimant a directory replaced is a rename, not a collision', () => {
        const root = mkdtempSync(join(tmpdir(), 'svelthon-claims-'));

        mkdirSync(join(root, 'lib'));
        writeFileSync(join(root, 'settings.py'), 'label = "sibling"\n');
        writeFileSync(join(root, 'lib', 'settings.py'), 'label = "library"\n');

        try {
            claimIn(join(root, 'settings.py'), root);
            unlinkSync(join(root, 'settings.py'));
            mkdirSync(join(root, 'settings.py'));

            expect(() => claimIn(join(root, 'lib', 'settings.py'), root)).not.toThrow();
        } finally {
            rmSync(root, { recursive: true, force: true });
        }
    });

    // A watched file is recompiled on every edit. Claiming the same path again
    // is the normal case, not a collision.
    test('the same file may claim its name as often as it likes', () => {
        nameFor('tests/fixtures/route.py');

        expect(() => nameFor('tests/fixtures/route.py')).not.toThrow();
    });

    test('two routes of one kind are not a collision', () => {
        nameFor('tests/fixtures/routes/blog/+page.server.py');

        expect(() => nameFor('tests/fixtures/routes/about/+page.server.py')).not.toThrow();
    });
});

// And end to end: two route modules of one kind load in one process, each with
// its own `load`.
test('two +page.server.py load side by side', async () => {
    const blog = await import('./fixtures/routes/blog/+page.server.py');
    const about = await import('./fixtures/routes/about/+page.server.py');

    // By name: the data says where its values came from under a symbol of its
    // own, which SvelteKit's merge carries.
    expect(Object.entries(await blog.load())).toEqual([['page', 'blog']]);
    expect(Object.entries(await about.load())).toEqual([['page', 'about']]);

    // A name no `import` can write is not published where imports look.
    expect(globalThis.__BRYTHON__.imported['+page.server']).toBeUndefined();
});
