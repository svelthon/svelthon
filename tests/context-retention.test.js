// @vitest-environment node
//
// A context key goes with the component that set it, as it goes from Svelte's
// own context map. The key a Python value's original is kept under was held in
// a global `Map`, made for every key written and every key read: 64 mounts, 64
// key objects alive after collection, where Svelte keeps none. Then in a
// `WeakMap` for an object and a `Map` for a string, which kept every string key
// ever written: about 8 MB after 2 000 keys of 4 096 characters. The original
// is now kept in the context itself, and goes with it.
//
// One child process under `--expose-gc`, skipped where a sandbox forbids
// spawning, like `link-retention.test.js`.
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { __pybridge, pyData } from '../src/lib/runtime.js';

const canSpawn = (() => {
    try {
        execFileSync(process.execPath, ['-e', ''], { stdio: 'ignore' });

        return true;
    } catch {
        return false;
    }
})();

test.skipIf(!canSpawn)('a context key set or read from Python is let go as Svelte lets it go', () => {
    const alive = JSON.parse(
        execFileSync(process.execPath, ['--expose-gc', 'tests/fixtures/context-retention.mjs'], {
            encoding: 'utf8'
        })
    );

    expect({ native: alive.native, provide: alive.provide, provided: alive.provided }).toEqual({
        native: 0,
        provide: 0,
        provided: 0
    });
    // The native writes are the witness of what the measurement itself leaves.
    expect(alive.provideStrings - alive.nativeStrings).toBeLessThan(1_000_000);
});

// While the key lives, the original comes back under every kind of key.
test.for([
    ['a string', 'theme'],
    ['an object', { name: 'theme' }],
    ['a symbol', Symbol('theme')],
    ['a registered symbol', Symbol.for('svelthon.test.theme')]
])('the original under %s comes back to Python', ([, key]) => {
    const contexts = new Map();
    const original = pyData({ answer: 42 });

    __pybridge.provide((k, v) => contexts.set(k, v), (k) => contexts.get(k), key, original);

    expect(__pybridge.provided((k) => contexts.get(k), key)).toBe(original);
});
