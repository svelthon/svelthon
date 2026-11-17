// @vitest-environment node
//
// What a page reads of Python data before the codec is loaded waits for it in a
// queue, and waited there for as long as the page lived: a JavaScript page that
// never loads the codec kept the data of every visit, twenty visits twenty
// copies after collection. The queue now holds them as the page does, and the
// copy the page still holds is read by Python as its value once the codec is
// there.
//
// One child process under `--expose-gc`, skipped where a sandbox forbids
// spawning, like `context-retention.test.js`.
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

test.skipIf(!canSpawn)('the data of a page left is let go, the codec loaded or not, and the data kept read by Python once it is', () => {
    const measured = JSON.parse(execFileSync(process.execPath, ['--expose-gc', 'tests/fixtures/pending-retention.mjs'], { encoding: 'utf8' }).trim().split('\n').pop());

    expect(measured).toEqual({ queued: 1, alive: 1, adopted: 'dict' });
});
