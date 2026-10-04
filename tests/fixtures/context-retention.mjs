// Run under `node --expose-gc`: sets and reads contexts under fresh keys, an
// object and a symbol of its own each time, in a context map that is then
// dropped, as a component's is when it is destroyed. Prints how many keys are
// still alive, for Svelthon's adapters and for the same writes made directly,
// which is what Svelte's `setContext` and `getContext` do.
import { __pybridge, pyData } from '../../src/lib/runtime.js';

const kept = { native: [], provide: [], provided: [] };

const once = (kind, key) => {
    const contexts = new Map();
    const set = (k, v) => contexts.set(k, v);
    const get = (k) => contexts.get(k);

    if (kind === 'native') set(key, 42);
    if (kind === 'provide') __pybridge.provide(set, key, pyData({ answer: 42 }));
    if (kind === 'provided') __pybridge.provided(get, key);

    kept[kind].push(new WeakRef(key));
};

for (const kind of Object.keys(kept)) {
    for (let i = 0; i < 64; i++) {
        once(kind, { kind });
        once(kind, Symbol(kind));
    }
}

for (let round = 0; round < 10; round++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    globalThis.gc();
}

const alive = Object.fromEntries(
    Object.entries(kept).map(([kind, refs]) => [kind, refs.filter((ref) => ref.deref() !== undefined).length])
);

process.stdout.write(`${JSON.stringify(alive)}\n`);
