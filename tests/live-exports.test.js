// A value a plain `.py` module exports follows the module's own writes, as a
// JavaScript module's `export let` does. It was captured once: after `bump()`
// the export still read `0`, where `read()` and another Python module both read
// `1`. Against a JavaScript module written the same way.
import { test, expect } from 'vitest';
import * as Python from './fixtures/live_exports.py';
import * as Native from './fixtures/live_exports_native.js';
import { write } from './fixtures/live_exports_writer.py';
import * as Reexport from './fixtures/js_reexport.py';
import * as ReexportNative from './fixtures/js_reexport_native.js';
import * as Source from './fixtures/js_reexport_source.js';
import store from './fixtures/js_reexport_store.svelte.py';
import { write as writeReexport } from './fixtures/js_reexport_writer.py';
import * as Defs from './fixtures/def_exports.py';
import * as DefsNative from './fixtures/def_exports_native.js';
import * as DefsStore from './fixtures/def_exports_store.svelte.py';

// A name first bound by `def` was published once, as the wrapper it was then:
// after the module made it a number the export was still a function, which
// failed when called, and after `del` it still answered. A name a decorator
// first made a number stayed that number once the module made it a function.
// Every exported name is the value it holds now, against a JavaScript module
// written the same way.
const shape = (value) => (typeof value === 'function' ? `function ${value()}` : String(value));

test('a name a `def` bound is exported as what it holds now', () => {
    const seen = [];

    for (const module of [Defs, DefsNative]) {
        module.restore();
        const steps = [shape(module.action)];

        for (const step of ['scalar', 'function_', 'remove', 'restore']) {
            module[step]();
            steps.push(shape(module.action));
        }
        seen.push(steps);
    }

    expect(seen[0]).toEqual(seen[1]);
    expect(seen[0]).toEqual(['function 7', '42', 'function 9', 'undefined', 'function 7']);
});

test('and a name a decorator made data becomes a function when the module says so', () => {
    expect([shape(Defs.data), shape(DefsNative.data)]).toEqual(['42', '42']);

    Defs.callable_data();
    DefsNative.callable_data();

    expect([shape(Defs.data), shape(DefsNative.data)]).toEqual(['function 7', 'function 7']);
});

// The same function written again is the same function, to Python and to the
// JavaScript reader that kept it: written back, `action is original` stays
// true and the export keeps its identity, which an `off()` after an `on()`
// needs, and Python reads a `function` under its own name.
// `python3` on the module: `[True, 'action', 'function']` both times.
test('a `def` written back to its name keeps its identity and its name', async () => {
    const m = await import('./fixtures/rebound_def.py');
    const kept = m.action;

    expect(m.held()).toEqual([true, 'action', 'function']);
    m.same_again();
    expect(m.held()).toEqual([true, 'action', 'function']);
    expect(m.action).toBe(kept);
});

// A reactive module's named exports were made once too, where its default
// export read the name: the two now agree.
test('a store’s named export follows the name as its default export does', () => {
    DefsStore.restore();
    const seen = [shape(DefsStore.action)];

    DefsStore.scalar();
    seen.push(shape(DefsStore.action), shape(DefsStore.default.action));
    DefsStore.remove();
    seen.push(shape(DefsStore.action), shape(DefsStore.default.action));
    DefsStore.restore();
    seen.push(shape(DefsStore.action));

    expect(seen).toEqual(['function 7', '42', '42', 'undefined', 'undefined', 'function 7']);
});

// And a write from Python to such a name, through `globals()` or from another
// module, was taken by Python's reader and missed by JavaScript's, the export
// staying at the source's value. JavaScript refuses an assignment to an import,
// and so does the namespace now, with the name and the module, and the two
// readers keep one value.
test.for([
    ['through globals()', () => Reexport.overwrite()],
    ['from another module', () => writeReexport()]
])('a write %s to a re-exported JavaScript name is refused', ([, write]) => {
    Source.reset();

    expect(write).toThrow(/'counter' is a JavaScript import of .*js_reexport\.py, and an import is read-only/);
    expect(Reexport.counter).toBe(0);
    expect(Reexport.read()).toBe(0);
});

// A name `__js__` brings, listed in `__all__`, was refused as one the module
// "never binds", in a `.py` and in a `.svelte.py`. And exported, it followed
// only the writes Python made through its namespace, never those its own
// JavaScript module made: re-exported now as the JavaScript binding it is,
// against JavaScript's own `export { … } from`.
test('a name `__js__` brings is exported, and follows its own module', () => {
    Source.reset();
    Source.bump();

    expect(Reexport.counter).toBe(1);
    expect(Reexport.counter).toBe(ReexportNative.counter);
    expect(Reexport.read()).toBe(1);

    Reexport.bump();

    expect(Reexport.counter).toBe(2);
    expect(store.counter).toBe(2);
    expect(store.read()).toBe(2);
});

test.for([
    ['Python', Python],
    ['JavaScript', Native]
])('in %s, the export reads what the module wrote last', ([, module]) => {
    module.reset();
    expect(module.counter).toBe(0);

    module.bump();
    expect(module.counter).toBe(1);
    expect(module.counter).toBe(module.read());

    // `=` in a function is the engine's other path: it deletes the name's own
    // property before it assigns it.
    module.reset();
    expect(module.counter).toBe(0);
});

test('and so does a write made by another Python module', () => {
    write(7);

    expect(Python.counter).toBe(7);
    expect(Python.read()).toBe(7);
});

test('and a class bound again under its name', () => {
    const before = Python.Shape;

    Python.swap();

    expect(Python.Shape).not.toBe(before);
    expect(Python.Shape).toBe(Python.Square);
});
