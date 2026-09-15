// @vitest-environment node
//
// What a dict of functions becomes on the way out of a module.
//
// The export adapted the functions of a dict only when *every* key held one, so
// a dict with a `"version": 1` beside them went through `plainData`, which keeps
// a function as it is. Writing that one line changed the calling contract of the
// function next to it: the same `async def` handed back a promise from one dict
// and a raw Brython coroutine from the other.
//
// And the same branch wrote its keys with `=`, so `{"__proto__": f}` reached the
// setter: the key was never an own property and the wrapped function became the
// object's prototype. `plainData` had learned to `defineProperty` around that;
// being fixed in one converter is not being fixed in the export.
import { test, expect, describe } from 'vitest';

describe('a module exporting dicts that hold functions', () => {
    const mod = () => import('./fixtures/exported_dicts.py');

    test('a dict of functions alone answers with a promise', async () => {
        const { pure } = await mod();

        await expect(pure.answer()).resolves.toBe(42);
        expect(pure.twice(21)).toBe(42);
    });

    // The defect: the neighbour decided for the function.
    test('and a value beside them changes nothing for them', async () => {
        const { mixed } = await mod();

        await expect(mixed.answer()).resolves.toBe(42);
        expect(mixed.twice(21)).toBe(42);
    });

    test('while the value beside them crosses as data', async () => {
        const { mixed } = await mod();

        expect(mixed.version).toBe(1);
        expect(mixed.tags).toEqual(['a']);
    });

    test('a dict of data alone is data', async () => {
        expect((await mod()).data).toEqual({ version: 1 });
    });

    test('Python holds the key, whatever JavaScript reads into it', async () => {
        const { proto_in_python, proto_keys } = await mod();

        expect(proto_in_python).toBe(true);
        expect(proto_keys).toEqual(['__proto__', 'kept']);
    });

    test('and `__proto__` is a key, not a prototype', async () => {
        const { special } = await mod();

        expect(Object.hasOwn(special, '__proto__')).toBe(true);
        expect(Object.keys(special).sort()).toEqual(['__proto__', 'kept']);
        expect(Object.getPrototypeOf(special)).toBe(Object.prototype);
        expect(special['__proto__'](21)).toBe(42);
    });
});
