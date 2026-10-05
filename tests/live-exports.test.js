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

    expect(write).toThrow(/'counter' is the JavaScript binding .*js_reexport\.py re-exports, and an import is read-only/);
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
