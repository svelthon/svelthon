// A value a plain `.py` module exports follows the module's own writes, as a
// JavaScript module's `export let` does. It was captured once: after `bump()`
// the export still read `0`, where `read()` and another Python module both read
// `1`. Against a JavaScript module written the same way.
import { test, expect } from 'vitest';
import * as Python from './fixtures/live_exports.py';
import * as Native from './fixtures/live_exports_native.js';
import { write } from './fixtures/live_exports_writer.py';

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
