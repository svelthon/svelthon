// @vitest-environment node
//
// JavaScript reading a slotted instance asks the view about each key in turn:
// `Object.keys`, `JSON.stringify` and a spread want a descriptor per key. The
// view answers about that one name, so the class dictionaries are looked up
// for it, not read off whole once per key, which made reading K slots cost K
// times the size of the class.
import { test, expect, vi } from 'vitest';
import '../src/lib/compile.cjs';
import '../src/lib/bridge.js';

test('reading every slot of an instance reads the class entries once', () => {
    const $B = globalThis.__BRYTHON__;
    const source = 'class Row:\n    __slots__ = tuple(f"f{i}" for i in range(50))\n\n\nrow = Row()\nfor name in Row.__slots__:\n    setattr(row, name, 1)\n';
    const js = $B.py2js({ src: source, filename: 'slot_view_cost.py' }, 'slot_view_cost', ['slot_view_cost']).to_js();
    const module = new Function(`${js}\nreturn locals_slot_view_cost_py;`)();
    const view = $B.pyobj2jsobj(module.row);
    const read = vi.spyOn($B.builtins.dict, '$iter_items');

    try {
        expect(Object.keys(JSON.parse(JSON.stringify(view)))).toHaveLength(50);
        expect(read.mock.calls.length).toBeLessThan(5);
    } finally {
        read.mockRestore();
    }
});
