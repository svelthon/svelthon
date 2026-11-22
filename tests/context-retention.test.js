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
import { __brycomp_pybridge, pyData } from '../src/lib/bridge.js';

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
    // A key published 64 times in a context still alive keeps the last value.
    expect(alive.replaced).toBe(1);
});

// A child publishing a key again keeps its own original and leaves its
// parent's: the parent's context is a map Svelte copies into the child's. A
// float `1.0` and an int `1` are both the number 1 to JavaScript, so only the
// original tells them apart.
test('a child publishing a key again leaves its parent’s original', () => {
    const $B = globalThis.__BRYTHON__;
    const parent = new Map();

    __brycomp_pybridge.provide((k, v) => parent.set(k, v), (k) => parent.get(k), () => parent, 'size', $B.builtins.float.$factory(1));
    const child = new Map(parent);
    __brycomp_pybridge.provide((k, v) => child.set(k, v), (k) => child.get(k), () => child, 'size', 1);

    expect($B.class_name(__brycomp_pybridge.provided((k) => parent.get(k), 'size'))).toBe('float');
    expect($B.class_name(__brycomp_pybridge.provided((k) => child.get(k), 'size'))).toBe('int');
});

// The originals were a list walked again, by recursion, for every key
// published: 16 000 keys in one context overflowed the stack near the
// 11 000th, where Svelte's own `setContext` takes them all. The first and the
// last still read back as Python set them.
test('a context of 16 000 keys published from Python is set whole', () => {
    const $B = globalThis.__BRYTHON__;
    const native = new Map();
    const contexts = new Map();

    for (let i = 0; i < 16000; i++) native.set(`key-${i}`, i);
    for (let i = 0; i < 16000; i++) {
        __brycomp_pybridge.provide((k, v) => contexts.set(k, v), (k) => contexts.get(k), () => contexts, `key-${i}`, $B.builtins.float.$factory(i));
    }

    expect(native.size).toBe(16000);
    expect($B.class_name(__brycomp_pybridge.provided((k) => contexts.get(k), 'key-0'))).toBe('float');
    expect($B.class_name(__brycomp_pybridge.provided((k) => contexts.get(k), 'key-15999'))).toBe('float');
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

    __brycomp_pybridge.provide((k, v) => contexts.set(k, v), (k) => contexts.get(k), () => contexts, key, original);

    expect(__brycomp_pybridge.provided((k) => contexts.get(k), key)).toBe(original);
});
