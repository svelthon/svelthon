// @vitest-environment node
//
// What a module publishes under a name is the value the name holds, crossing
// for what it is, and not for the statement that bound the name.
//
// A store read every name that was not its own `def` as data, so a function
// imported from another module reached JavaScript raw: a Brython float back, a
// JavaScript number refused as an argument, a coroutine that never ran. And a
// `def` was published as a function in both kinds of module, whatever a
// decorator or a later line had put in its place.
import { test, expect, describe } from 'vitest';
import named from './fixtures/crossing_named_store.svelte.py';
import starred from './fixtures/crossing_star_store.svelte.py';
import * as replaced from './fixtures/replaced_defs.py';
import replacedStore, * as replacedExports from './fixtures/replaced_defs_store.svelte.py';
import * as astral from './fixtures/astral_text.py';
import * as astralStore from './fixtures/astral_text_store.svelte.py';
import * as rawValues from './fixtures/raw_json_values.py';
import { raw, boxed, indexed, tagged, trapped, pointed } from './fixtures/raw_json.js';

describe.for([
    ['imported by name', named],
    ['brought by a star import', starred]
])('a store hands on a function %s as it hands on its own', ([, store]) => {
    test('a float it returns is a number', () => {
        expect(store.fraction()).toBe(0.25);
        expect(store.local_fraction()).toBe(0.25);
    });

    test('a number it is given is a float', () => {
        expect(store.formatted(0.25)).toBe('0.25');
    });

    test('a coroutine it returns is started, once', async () => {
        const before = store.run_count();

        await expect(store.async_fraction()).resolves.toBe(0.25);
        expect(store.run_count()).toBe(before + 1);
    });

    test('a container it returns is the one Python holds', () => {
        expect(store.rows()).toBe(store.rows());
    });

    test('what it raises names the function', () => {
        expect(() => store.failing()).toThrow(/failing\(\)/);
    });

    test('and it is one function however often it is read', () => {
        expect(store.fraction).toBe(store.fraction);
    });
});

test("a store's derived that answers a function hands on a call", () => {
    expect(named.chosen()).toBe(0.25);
});

describe.for([
    ['a .py', replaced],
    ['a .svelte.py, on its store', replacedStore],
    ['a .svelte.py, by name', replacedExports]
])('in %s, a def replaced before the module ended is what replaced it', ([, published]) => {
    test('a dict a decorator returned', () => {
        expect(typeof published.settings).toBe('object');
        expect(published.settings.answer).toBe(42);
    });

    test('a float a decorator returned', () => {
        expect(published.ratio).toBe(0.5);
    });

    test('a number assigned after the def', () => {
        expect(published.item).toBe(42);
    });

    test('and a function a decorator handed back is still a function', () => {
        expect(published.kept()).toBe(0.25);
    });
});

// A str holding a character past U+FFFF is a `String` object in Brython, and it
// crossed as one, an object JavaScript prints as the text and compares as
// nothing: `value === "🌍"` was false on every path.
describe.for([
    ['a .py', astral],
    ['a .svelte.py', astralStore.store]
])('in %s, text past U+FFFF is a JavaScript string', ([, published]) => {
    test('as a value', () => {
        expect(published.globe).toBe('🌍');
    });

    test('returned by a function', () => {
        expect(published.give()).toBe('🌍');
    });
});

test('a str subclass holding text past U+FFFF crosses as the text', () => {
    expect(astral.tagged).toBe('🌍');
});

// A raw JSON text has no prototype, and was copied out as `{rawJSON: "…"}`, its
// slot left behind, by every walk that hands Python's values to JavaScript.
test('a raw JSON text JavaScript handed Python comes back as itself', () => {
    expect(rawValues.kept).toBe(raw);
    expect(rawValues.held.raw).toBe(raw);

    const json = JSON.stringify({ raw, boxed, indexed, tagged, trapped, pointed: pointed() });

    expect(rawValues.written()).toBe(json);
});

// Last, since it rebinds a name of the fixture.
describe("a store's def", () => {
    test('is one function on the store and by name', () => {
        expect(replacedStore.kept).toBe(replacedExports.kept);
    });

    // A function held across the assignment is the function it read, as one
    // held from a `.py`, from a JavaScript module or in Python is; the name is
    // read when it is read, so a later assignment shows there. Held as the
    // name's, it called the next function, and failed once the name was
    // deleted (`store-kept-function.test.js`).
    test('and keeps the function it read, where the name shows a later assignment', () => {
        const held = replacedStore.kept;

        replacedStore.rebind();

        expect([held(), replacedStore.kept(), replacedStore.kept === held, replacedStore.item]).toEqual([0.25, 0.75, false, 43]);
    });
});
