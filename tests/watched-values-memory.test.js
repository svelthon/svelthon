import { test, expect } from 'vitest';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';
import * as data from './fixtures/watched_rows.py';
import { track, pyBind } from '../src/lib/bridge.js';

// The collector, which Node hands a script only under `--expose-gc`: the flag
// is set for this file alone, and the rest of the suite runs as it always has.
setFlagsFromString('--expose-gc');
const collect = runInNewContext('gc');

// What the heap holds once collected, in megabytes.
const held = () => {
    collect();
    collect();

    return process.memoryUsage().heapUsed / 1e6;
};

// What a third batch of eight rounds adds to what two left held, all in one
// job: what a round keeps for good grows with every batch, the room the
// engine's own tables keep stops growing by the second.
const kept = (round) => {
    const batch = () => {
        for (let at = 0; at < 8; at++) round();

        return held();
    };

    batch();
    batch();
    const before = batch();

    return batch() - before;
};

const N = 10000;

// The list a component's name would watch, as Python holds it.
track(pyBind(data.rows), () => {});

// **A value that can change, made again and again in one job under a watch, is
// let go as the job goes on**, as a JavaScript object is: an object of the
// author's in a set, a row of data holding a list, as dict or as list. Each
// watched value took a weak reference, whose target lives until the job that
// made it ends: eight refills of 20 000 in one handler kept 654 MB of objects
// and 707 MB of rows, and a worker died of it. A JavaScript `Set` refilled as
// often is the witness.
test('a job refilling a watched container with values that can change keeps none of them', () => {
    const native = new Set();

    const retained = {
        javascript: kept(() => {
            native.clear();
            for (let i = 0; i < N; i++) native.add({ i, tags: [i] });
            for (const one of native) void one;
        }),
        objects: kept(() => {
            data.fill_cells(N);
            for (const one of data.cells) void one;
        }),
        records: kept(() => data.fill_records(N)),
        pairs: kept(() => data.fill_pairs(N))
    };

    for (const [shape, megabytes] of Object.entries(retained)) expect(megabytes, shape).toBeLessThan(10);

    data.empty();
});

// A child kept once its rows are let go keeps its own row, which holds it, and
// not the rows around it: the chain stops at the first value nothing reads and
// no watched container holds. The rows read by a name, then by none, are let go
// as JavaScript lets go of an array of objects one of whose arrays it kept.
test('a child kept out of rows let go keeps its own row and not the rows', () => {
    // Rows watched as a name watches them, then let go, a child of the first
    // row kept or not.
    const letGo = (keep) => {
        const bump = () => {};
        let rows = pyBind(data.fresh_records(N));

        track(rows, bump);

        const tags = keep ? pyBind(data.first_tags(rows)) : undefined;

        track(undefined, bump);
        rows = undefined;

        return tags;
    };

    const native = () => {
        let rows = Array.from({ length: N }, (_, i) => ({ id: i, tags: [i] }));
        const tags = rows[0].tags;

        rows = undefined;

        return tags;
    };

    // Twice first, so the engine's own tables have the room they keep.
    letGo(false);
    letGo(false);

    const before = held();
    const javascript = native();
    const witness = held() - before;
    const none = held();
    const tags = letGo(true);

    expect(witness, 'javascript').toBeLessThan(2);
    expect(held() - none).toBeLessThan(2);
    expect(tags.length).toBe(1);
    expect(javascript.length).toBe(1);
});
