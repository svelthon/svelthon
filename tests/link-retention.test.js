// @vitest-environment node
//
// A container that is gone takes its links with it, whether or not the child it
// held ever changes again. A shared child kept a strong link to every dict that
// had wrapped it, and through it the key the dict held it under, until the
// child itself was next mutated: 3 000 discarded dicts, 3 000 object keys still
// alive. `link-lifetime.test.js` covers the pruning a mutation does; this is the
// time before one.
//
// The keys must all be collected. The links are bounded rather than zero: the
// list is swept when it grows, so what stays is at most the last batch, whose
// dicts were still alive when the next link arrived.
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

test.skipIf(!canSpawn)('a shared child does not keep the keys of dicts that are gone', () => {
    const out = JSON.parse(
        execFileSync(process.execPath, ['--expose-gc', 'tests/fixtures/link-retention.mjs'], {
            encoding: 'utf8'
        })
    );

    expect(out.controls).toBe(0);
    expect(out.keys).toBe(0);
    expect(out.parents).toBeLessThanOrEqual(300);
});
