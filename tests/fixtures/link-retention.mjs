// Run under `node --expose-gc`: wraps one shared list in dicts under object
// keys, watches each dict and signs it off, drops them, collects, and prints
// what is still alive. Keys of dicts never watched are the control that says a
// collection happened. The shared list itself is never mutated: that would
// prune the links on its own and hide what this measures.
import { track, unsubscribe, marks } from '../../src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const _b_ = $B.builtins;
const shared = $B.$list([]);

const keys = [];
const controls = [];

const batch = () => {
    for (let i = 0; i < 300; i++) {
        const key = _b_.object.$factory();
        const dict = _b_.dict.$factory();
        const owner = [];

        $B.$setitem(dict, key, shared);
        track(dict, () => {}, owner);
        unsubscribe(owner);
        keys.push(new WeakRef(key));

        const control = _b_.object.$factory();

        $B.$setitem(_b_.dict.$factory(), control, shared);
        controls.push(new WeakRef(control));
    }
};

const collect = async () => {
    for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setImmediate(resolve));
        globalThis.gc();
    }
};

const live = (refs) => refs.filter((ref) => ref.deref() !== undefined).length;

batch();
await collect();
batch();
await collect();

process.stdout.write(
    JSON.stringify({
        keys: live(keys),
        controls: live(controls),
        parents: marks(shared).parents.length
    })
);
