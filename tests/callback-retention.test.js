// @vitest-environment node
//
// A callback handed to JavaScript lives as long as JavaScript holds it, and no
// longer. A method bound to a string is cached by value, since a primitive
// cannot key a WeakMap, and the first cache held every wrapper it ever made:
// 9 000 discarded `"…".upper` callbacks, 9 000 still alive. The lists are the
// witness for the object receivers, and the closures say a collection happened
// at all.
//
// One child process under `--expose-gc`, skipped where a sandbox forbids
// spawning, like `boot-conditions.test.js`.
import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';

const canSpawn = (() => {
    try {
        execFileSync(process.execPath, ['-e', ''], { stdio: 'ignore' });

        return true;
    } catch {
        return false;
    }
})();

test.skipIf(!canSpawn)('a dropped callback bound to a string is collected', () => {
    const out = JSON.parse(
        execFileSync(process.execPath, ['--expose-gc', 'tests/fixtures/callback-retention.mjs'], {
            encoding: 'utf8'
        })
    );

    expect(out.closures).toBe(0);
    expect(out.lists).toBe(0);
    expect(out.strings).toBe(0);
    expect(out.same).toBe(true);
    expect(out.answer).toBe('HELD');
});

// A symbol's hash was kept in a Map that nobody emptied (branch `symbol-hash`),
// so every symbol that once was the key of a dict, the rest of a JavaScript row
// among them, stayed alive. Kept in a WeakMap now; the plain objects, which
// carry their hash on themselves, are the control.
test.skipIf(!canSpawn)('a symbol hashed as the key of a dropped dict is collected', () => {
    const out = JSON.parse(
        execFileSync(process.execPath, ['--expose-gc', 'tests/fixtures/symbol-retention.mjs'], { encoding: 'utf8' })
    );

    // The control keeps its last one, which the loop still reaches: the
    // symbols are held to the same count, not to zero.
    expect(out.objects).toBeLessThan(5);
    expect(out.symbols).toBe(out.objects);
});
