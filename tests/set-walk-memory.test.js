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

// What sixteen more walks leave held, after a first one.
const kept = (walk) => {
    walk();
    const before = held();

    for (let round = 0; round < 16; round++) walk();

    return held() - before;
};

// A walk of a set from JavaScript keeps what it records, the members it has
// visited and those it has not reached yet, while it runs and no longer. Its
// records were held through a weak reference, whose target lives until the job
// that made it ends: sixteen walks of 20 000 ints in one job, as a loop does,
// kept 81 MB. A JavaScript `Set` walked as often is the witness.
test('a walk of a set keeps nothing of what it recorded once it has ended', () => {
    const members = Array.from({ length: 20000 }, (_, i) => i);
    const native = new Set(members);
    const walked = (set) => () => {
        for (const one of set) void one;
    };
    // Deleting the members it has not reached yet, as a sieve does, a walk
    // records those as well, and stopped halfway, as a search is, it still
    // holds them and the rest of its pass.
    const sieve = (set, refill) => () => {
        refill();
        let at = 0;

        for (const one of set) {
            void one;
            set.delete(at + 1);
            at += 2;
            if (at >= members.length / 2) break;
        }
    };

    // Adding members as it goes, as a worklist does, a walk records what
    // arrived, and stopped before its next pass, it still holds it.
    const worklist = (set, refill) => () => {
        refill();

        for (const one of set) {
            void one;
            members.forEach((other) => set.add(other));
            break;
        }
    };

    sets.refill(members);

    expect(kept(walked(native))).toBeLessThan(4);
    expect(kept(walked(sets.walked))).toBeLessThan(4);
    expect(kept(sieve(native, () => members.forEach((one) => native.add(one))))).toBeLessThan(4);
    expect(kept(sieve(sets.walked, () => sets.refill(members)))).toBeLessThan(4);
    expect(kept(worklist(native, () => (native.clear(), native.add(-1))))).toBeLessThan(4);
    expect(kept(worklist(sets.walked, () => sets.refill([-1])))).toBeLessThan(4);
});
