// Run under `node --expose-gc`: adapts native methods bound to strings and to
// lists, drops them, collects, and prints how many are still alive. Plain
// JavaScript closures are the control that says a collection happened.
import { pyHandler } from '../../src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const adapted = (value, operation) => pyHandler($B.$getattr(value, operation));

const strings = [];
const lists = [];
const closures = [];

for (let i = 0; i < 500; i++) {
    strings.push(new WeakRef(adapted(`dropped-${i}`, 'upper')));
    lists.push(new WeakRef(adapted($B.$list([]), 'append')));
    closures.push(new WeakRef(() => i));
}

// A wrapper still held keeps its identity.
const held = adapted('held', 'upper');

for (let i = 0; i < 5; i++) {
    await new Promise((resolve) => setImmediate(resolve));
    globalThis.gc();
}

const live = (refs) => refs.filter((ref) => ref.deref() !== undefined).length;

process.stdout.write(
    JSON.stringify({
        strings: live(strings),
        lists: live(lists),
        closures: live(closures),
        same: adapted('held', 'upper') === held,
        answer: held()
    })
);
