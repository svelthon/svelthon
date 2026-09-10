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

import { mangle, nameFor, svelthon } from '../src/lib/svelthon.js';

describe('two files that mangle to one module name', () => {
    // Called directly rather than through the `script` hook, which would read
    // each file off disk for its source map. The contract under test is the one
    // written above `nameFor` itself.
    //
    // The registry is per process, so each test names its own pair rather than
    // relying on what a previous one claimed.
    const compile = (filename) => nameFor(filename);

    test('the second is refused, and both files are named', () => {
        compile('src/one/alpha.svelte');

        expect(() => compile('src/one_alpha.svelte')).toThrow(
            /`src\/one_alpha\.svelte` and `src\/one\/alpha\.svelte` both compile to the module name `src_one_alpha_svelte`/
        );
    });

    test('a dash and an underscore collide the same way', () => {
        compile('src/two-beta.svelte');

        expect(() => compile('src/two_beta.svelte')).toThrow(/both compile to the module name/);
    });

    test('and the message says what to do about it', () => {
        compile('src/three/gamma.svelte');

        expect(() => compile('src/three_gamma.svelte')).toThrow(/Rename one of them/);
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

    test('mangle answers the same name, it simply does not record it', () => {
        expect(mangle('src/eight/theta.svelte')).toBe('src_eight_theta_svelte');
        expect(mangle('src/eight_theta.svelte')).toBe('src_eight_theta_svelte');
        expect(nameFor('src/eight/theta.svelte')).toBe('src_eight_theta_svelte');
    });
});
