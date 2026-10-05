// Run under `node --expose-gc`: puts 500 unique symbols, then 500 plain
// JavaScript objects, each as the key of a dict nobody keeps, drops everything,
// collects, and prints how many are still alive. The objects are the control:
// they hold their hash on themselves.
import '../../src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const _b_ = $B.builtins;

const symbols = [];
const objects = [];

for (let i = 0; i < 500; i++) {
    const token = Symbol(`row-${i}`);
    const plain = { i };
    const keyed = _b_.dict.$factory();

    $B.$setitem(keyed, token, i);
    $B.$setitem(keyed, plain, i);
    symbols.push(new WeakRef(token));
    objects.push(new WeakRef(plain));
}

for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    globalThis.gc();
}

const live = (refs) => refs.filter((ref) => ref.deref() !== undefined).length;

process.stdout.write(JSON.stringify({ symbols: live(symbols), objects: live(objects) }));
