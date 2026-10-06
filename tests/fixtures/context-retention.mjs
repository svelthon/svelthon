// Run under `node --expose-gc`: sets and reads contexts under fresh keys, an
// object and a symbol of its own each time, in a context map that is then
// dropped, as a component's is when it is destroyed. Prints how many keys are
// still alive, for Svelthon's adapters and for the same writes made directly,
// which is what Svelte's `setContext` and `getContext` do.
//
// And a fresh string key each time, which no weak reference can watch: what is
// left of 2 000 of them, 4 096 characters each, is read off the heap, for the
// adapter and for the same writes made directly.
import { randomBytes } from 'node:crypto';
import { __pybridge, pyData } from '../../src/lib/runtime.js';

const kept = { native: [], provide: [], provided: [] };

const once = (kind, key) => {
    const contexts = new Map();
    const set = (k, v) => contexts.set(k, v);
    const get = (k) => contexts.get(k);

    if (kind === 'native') set(key, 42);
    if (kind === 'provide') __pybridge.provide(set, get, () => contexts, key, pyData({ answer: 42 }));
    if (kind === 'provided') __pybridge.provided(get, key);

    kept[kind].push(new WeakRef(key));
};

for (const kind of Object.keys(kept)) {
    for (let i = 0; i < 64; i++) {
        once(kind, { kind });
        once(kind, Symbol(kind));
    }
}

const settle = async () => {
    for (let round = 0; round < 10; round++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
        globalThis.gc();
    }
};

await settle();

const alive = Object.fromEntries(
    Object.entries(kept).map(([kind, refs]) => [kind, refs.filter((ref) => ref.deref() !== undefined).length])
);

const leftBy = async (write) => {
    await settle();
    const before = process.memoryUsage().heapUsed;

    for (let i = 0; i < 2000; i++) {
        const contexts = new Map();

        write((k, v) => contexts.set(k, v), (k) => contexts.get(k), () => contexts, randomBytes(2048).toString('hex'));
    }

    await settle();

    return process.memoryUsage().heapUsed - before;
};

alive.nativeStrings = await leftBy((set, get, own, key) => set(key, 0.5));
alive.provideStrings = await leftBy((set, get, own, key) => __pybridge.provide(set, get, own, key, pyData(0.5)));

// And a value published again under one key of a context still alive: the 63
// it replaced go, as `Map.set` lets them go.
const live = new Map();
const replaced = [];

for (let i = 0; i < 64; i++) {
    const value = pyData({ answer: i });

    replaced.push(new WeakRef(value));
    __pybridge.provide((k, v) => live.set(k, v), (k) => live.get(k), () => live, 'theme', value);
}

await settle();
alive.replaced = replaced.filter((ref) => ref.deref() !== undefined).length;
alive.contextSize = live.size;

process.stdout.write(`${JSON.stringify(alive)}\n`);
