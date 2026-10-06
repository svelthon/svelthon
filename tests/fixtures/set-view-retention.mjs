// Run under `node --expose-gc`: members added to a Python set through its view
// and gone from it again, deleted from JavaScript or cleared by Python, while
// the view itself stays alive. Prints how many of them are still alive.
import '../../src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const views = [];

const members = (raw) => Array.from($B.make_js_iterator(raw, $B.NULL));

// An instance, which a set holds by identity; a literal would cross as a dict.
class Item {
    constructor(i) {
        this.i = i;
    }
}

const run = (kind) => {
    const raw = $B.builtins.set.$factory();
    const view = $B.pyobj2jsobj_hook(raw);
    const weak = [];

    views.push(view);

    for (let i = 0; i < 64; i++) {
        if (kind === 'float deleted') {
            view.add(i + 0.5);
            weak.push(new WeakRef(members(raw)[0]));
            view.delete(i + 0.5);
        } else {
            const one = new Item(i);

            weak.push(new WeakRef(one));
            view.add(one);
            if (kind === 'object deleted') view.delete(one);
        }
    }

    if (kind === 'cleared by Python') $B.$call($B.$getattr(raw, 'clear'));

    return weak;
};

const kinds = ['float deleted', 'object deleted', 'cleared by Python'];
const weak = Object.fromEntries(kinds.map((kind) => [kind, run(kind)]));

for (let round = 0; round < 10; round++) {
    await new Promise((resolve) => setTimeout(resolve, 10));
    globalThis.gc();
}

const alive = Object.fromEntries(kinds.map((kind) => [kind, weak[kind].filter((ref) => ref.deref() !== undefined).length]));

alive.views = views.length;
process.stdout.write(`${JSON.stringify(alive)}\n`);
