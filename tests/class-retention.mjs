// How many classes, made and dropped, are still alive once collected: run by
// `tests/class-retention.test.js` under `node --expose-gc`, since a test cannot
// trigger a collection. Prints `{kind: alive}` as JSON.
import { createRequire } from 'node:module';

createRequire(import.meta.url)('../src/lib/compile.cjs');
await import('../src/lib/runtime.js');

const $B = globalThis.__BRYTHON__;
const print = console.log;
console.log = () => {};

const source = `
shared = []


def make(kind):
    class Token:
        rows = shared if kind == "a shared list read by its class name" else []

    if kind != "a list nobody reads":
        Token.rows
    return Token


class Base:
    pass


def derive():
    class Token(Base):
        pass

    return Token
`;
const js = $B.py2js({ src: source, filename: 'retention.py' }, 'retention', ['retention']).to_js();
const ns = new Function(`${js}\nreturn locals_retention_py;`)();

const made = {};
for (const kind of ['a shared list read by its class name', 'an own list read', 'a list nobody reads']) {
    made[kind] = Array.from({ length: 24 }, () => new WeakRef($B.$call(ns.make, kind)));
}
made['a subclass of a class that stays'] = Array.from({ length: 24 }, () => new WeakRef($B.$call(ns.derive)));

for (let round = 0; round < 5; round += 1) {
    await new Promise((resolve) => setImmediate(resolve));
    globalThis.gc();
}

print(JSON.stringify(Object.fromEntries(Object.entries(made).map(([kind, refs]) => [kind, refs.filter((ref) => ref.deref()).length]))));
