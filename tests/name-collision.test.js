// @vitest-environment node
//
// The generated module name is the path with every character that cannot appear
// in a JavaScript identifier replaced by `_`. The comment above it says the
// result must be unique across the project, and `\W → _` gives the valid half
// and not the unique one:
//
//     src/ui/card.svelte  ->  src_ui_card_svelte
//     src/ui_card.svelte  ->  src_ui_card_svelte
//     src/ui-card.svelte  ->  src_ui_card_svelte
//
// Both components then emitted the same `import { init } from
// 'virtual:svelthon/src_ui_card_svelte'`, and the second ran the first one's
// Python module body. Silently, which is the failure this project refuses.
import { test, expect, describe } from 'vitest';

import { nameFor, svelthon } from '../src/lib/svelthon.js';

describe('two files that mangle to one module name', () => {
    // Called directly rather than through the `script` hook, which would read
    // each file off disk for its source map. The contract under test is the one
    // written above `nameFor` itself.
    //
    // The paths are real files, and that is not decoration: the refusal now asks
    // whether the first claimant is still on disk, so an invented path is no
    // longer a collision. `tests/fixtures/collide-name.svelte` and friends exist
    // for their names and nothing compiles them.
    //
    // The registry is per process. A pair may be replayed, because re-claiming
    // from the same path is allowed and the second path still collides, but no
    // test relies on what another one claimed.
    const compile = (filename) => nameFor(filename);

    test('the second is refused, and both files are named', () => {
        compile('tests/fixtures/collide/deep.svelte');

        expect(() => compile('tests/fixtures/collide_deep.svelte')).toThrow(
            /`tests\/fixtures\/collide_deep\.svelte` and `tests\/fixtures\/collide\/deep\.svelte` both compile to the module name `tests_fixtures_collide_deep_svelte`/
        );
    });

    test('a dash and an underscore collide the same way', () => {
        compile('tests/fixtures/collide-name.svelte');

        expect(() => compile('tests/fixtures/collide_name.svelte')).toThrow(
            /both compile to the module name/
        );
    });

    test('and the message says what to do about it', () => {
        compile('tests/fixtures/collide-name.svelte');

        expect(() => compile('tests/fixtures/collide_name.svelte')).toThrow(/Rename one of them/);
    });

    // A claim is never released, so before this the registry outlived the file.
    // Renaming `ui-card.svelte` to `ui_card.svelte` while the dev server ran was
    // refused as a collision with a file that had just stopped existing, and the
    // cure, restarting the server, was named nowhere in the message.
    //
    // A renamed-away file is, mechanically, a claimant no longer on disk, which
    // is what these two paths are.
    test('a first claimant that is gone is a rename, not a collision', () => {
        compile('tests/fixtures/renamed-away.svelte');

        expect(() => compile('tests/fixtures/renamed_away.svelte')).not.toThrow();
    });

    // And the new claimant takes the name over, rather than the registry keeping
    // a path that leads nowhere.
    test('and the file that is there ends up holding the name', () => {
        compile('tests/fixtures/moved-on.svelte');
        compile('tests/fixtures/moved_on.svelte');

        expect(nameFor('tests/fixtures/moved_on.svelte')).toBe('tests_fixtures_moved_on_svelte');
    });

    // The preprocessor runs its hooks more than once per file, and a watched file
    // is recompiled on every edit. Claiming a name twice from the same path is
    // the normal case, not a collision.
    test('the same file may claim its name as often as it likes', () => {
        compile('src/four/delta.svelte');
        compile('src/four/delta.svelte');

        expect(() => compile('src/four/delta.svelte')).not.toThrow();
    });

    test('and two files that mangle apart are both fine', () => {
        compile('src/five/epsilon.svelte');

        expect(() => compile('src/five/zeta.svelte')).not.toThrow();
    });
});

// Claiming is what refuses, so only the two hooks that *emit* a module may
// claim. `hotUpdate` runs for every file the dev server sees change, component
// or not, and asks one question: is this one of mine? Asking used to claim, so
// two TypeScript files that hold no Python at all collided with each other and
// read a message about Python they had never written. It surfaced as an HMR
// failure, which is the harder kind to trace back.
describe('asking whether a module exists does not claim its name', () => {
    const environment = {
        moduleGraph: { getModuleById: () => undefined, invalidateModule: () => {} }
    };

    const touch = (file) =>
        svelthon().hotUpdate.call({ environment }, { file, modules: [] });

    test('two files of someone else’s that mangle alike both pass through', () => {
        touch('src/six-utils.ts');

        expect(() => touch('src/six_utils.ts')).not.toThrow();
    });

    test('and neither of them ends up claimed', () => {
        touch('src/seven-utils.ts');

        expect(() => nameFor('src/seven_utils.ts')).not.toThrow();
    });

    // The two answer the same name; only one records it. Asked through the hook
    // that merely asks, both spellings pass and neither is claimed, which is the
    // whole difference stated as behaviour rather than as two function names.
    test('asking twice about two colliding paths claims neither', () => {
        touch('src/eight/theta.svelte');
        touch('src/eight_theta.svelte');

        expect(nameFor('src/eight/theta.svelte')).toBe('src_eight_theta_svelte');
    });
});
