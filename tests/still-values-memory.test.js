import { test, expect } from 'vitest';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import * as sets from './fixtures/synced_sets.py';

// The collector, which Node hands a script only under `--expose-gc`: the flag
// is set for this file alone, and the rest of the suite runs as it always has.
setFlagsFromString('--expose-gc');
const collect = runInNewContext('gc');

// What the heap holds once collected, in megabytes: a number of the code, and
// not of the machine's load, as a time is.
const held = () => {
    collect();
    collect();

    return process.memoryUsage().heapUsed / 1e6;
};

// What a third batch of eight rounds adds to what two left held, all in one
// job. What a round keeps for good grows with every batch; the room the
// engine's own tables keep, for the most they held between two collections,
// stops growing by the second.
const kept = (round) => {
    const batch = () => {
        for (let at = 0; at < 8; at++) round();

        return held();
    };

    batch();
    const before = batch();

    return batch() - before;
};

// **A value that cannot change is not watched**: a tuple or a frozenset holding
// nothing that can change, and the engine's own floats, large ints and strings.
// Watched, each took a marker and a weak reference, whose target lives until
// the job that made it ends: a handler filling a watched set with 20 000
// `(i, frozenset())` eight times in one job kept 900 MB, and gave nothing back
// once the set was emptied. A JavaScript `Set` filled as often is the witness.
test('a job filling a watched set with values that cannot change keeps none of them', () => {
    const N = 20000;
    const native = new Set();
    const nativeRound = () => {
        native.clear();
        for (let i = 0; i < N; i++) native.add([i, new Set()]);
        for (const one of native) void one;
    };
    const pythonRound = () => {
        sets.fill_cells(N);
        for (const one of sets.walked) void one;
    };

    expect(kept(nativeRound)).toBeLessThan(10);
    expect(kept(pythonRound)).toBeLessThan(10);

    const filled = held();

    sets.refill([]);
    native.clear();

    expect(held()).toBeLessThan(filled);
});
