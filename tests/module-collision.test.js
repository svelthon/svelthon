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
import { nameFor } from '../src/lib/svelthon.js';

describe('two Python modules of one name', () => {
    test('the second is refused, and both files are named', () => {
        nameFor('tests/fixtures/collide/config.py');

        expect(() => nameFor('tests/fixtures/collide_again/config.py')).toThrow(
            /`tests\/fixtures\/collide_again\/config\.py` and `tests\/fixtures\/collide\/config\.py` are both imported as `config`.*Rename one of them/
        );
    });

    // Paths nothing has on disk: the first claimant is gone, which is what a
    // file moved under a running dev server looks like.
    test('a first claimant that is gone is a rename, not a collision', () => {
        nameFor('tests/fixtures/gone/panier.svelte.py');

        expect(() => nameFor('tests/fixtures/moved/panier.svelte.py')).not.toThrow();
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

    expect(await blog.load()).toEqual({ page: 'blog' });
    expect(await about.load()).toEqual({ page: 'about' });
});
