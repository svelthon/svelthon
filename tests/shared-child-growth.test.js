// @vitest-environment node
//
// A child shared by many containers, a list every row holds or a class every
// instance reads an attribute off, costs what it links: eight times the
// containers take about eight times as long. Each new link searched the whole
// list of the child's parents and swept it, and eight times the containers took
// sixty-four times as long.
//
// Measured so that the suite's load does not decide it: the heap is collected
// before each run, no run keeps the rows of another, and the ratio is read at
// eight times the size, where linear and quadratic are 8 and 64 and the bound,
// 24, sits a factor three from both.
import { test, expect } from 'vitest';
import v8 from 'node:v8';
import { runInNewContext } from 'node:vm';
import { track } from '../src/lib/bridge.js';

test('linking a child shared by n containers grows with n', () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc');
    const $B = globalThis.__BRYTHON__;
    const run = (n) => {
        const shared = $B.$list([]);
        const rows = [];

        gc();
        const start = performance.now();

        for (let i = 0; i < n; i++) {
            const row = $B.$list([shared]);

            rows.push(row);
            track(row, () => {});
        }

        return performance.now() - start;
    };
    // The best of three runs, from a size whose run lasts tens of milliseconds,
    // as the walks of a set are measured (`synced-exports.test.js`).
    const best = (n) => Math.min(run(n), run(n), run(n));
    let n = 1000;

    run(500);
    while (n < 256000 && best(n) < 30) n *= 2;

    expect(best(8 * n) / Math.max(best(n), 1)).toBeLessThan(24);
}, 120000);
