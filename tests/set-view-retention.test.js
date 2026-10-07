// @vitest-environment node
//
// A set's view keeps nothing of the members that left the set: a record of the
// members it had added, kept to visit again one added back during a walk, held
// every float added and deleted from JavaScript, the deletion converting the
// number anew, and every member a clear from Python let go, while the view
// lived. Nor a dict's view of the keys that left the dict: its names are kept
// by place, not by key, where the keys of its last read stayed alive after a
// clear from Python. One child process under `--expose-gc`, skipped where a
// sandbox forbids spawning, like `context-retention.test.js`.
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

test.skipIf(!canSpawn)('a member gone from a set, a key gone from a dict, is let go while its view lives', () => {
    const alive = JSON.parse(
        execFileSync(process.execPath, ['--expose-gc', 'tests/fixtures/set-view-retention.mjs'], { encoding: 'utf8' })
    );

    expect(alive).toEqual({
        'float deleted': 0,
        'object deleted': 0,
        'cleared by Python': 0,
        'dict cleared by Python': 0,
        views: 4
    });
});
