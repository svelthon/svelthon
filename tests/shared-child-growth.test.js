// @vitest-environment node
//
// A child shared by many containers, a list every row holds or a class every
// instance reads an attribute off, costs what it links: four times the
// containers take about four times as long. Each new link searched the whole
// list of the child's parents and swept it, and four times the containers took
// sixteen times as long.
import { test, expect } from 'vitest';
import { track } from '../src/lib/runtime.js';

test('linking a child shared by n containers grows with n', () => {
    const $B = globalThis.__BRYTHON__;
    const held = [];
    const run = (n) => {
        const shared = $B.$list([]);
        const rows = [];
        const start = performance.now();

        for (let i = 0; i < n; i++) {
            const row = $B.$list([shared]);

            rows.push(row);
            track(row, () => {}, () => {});
        }

        const spent = performance.now() - start;

        held.push(rows);

        return spent;
    };
    // The better of two runs, from a size whose run lasts tens of milliseconds,
    // as the walks of a set are measured (`synced-exports.test.js`).
    const best = (n) => Math.min(run(n), run(n));
    let n = 1000;

    run(500);
    while (n < 256000 && best(n) < 30) n *= 2;

    expect(best(4 * n) / Math.max(best(n), 1)).toBeLessThan(8);
}, 60000);
