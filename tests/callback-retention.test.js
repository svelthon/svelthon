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
