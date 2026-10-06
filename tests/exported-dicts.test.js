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

    // The same list under two keys. This is the graph rule, and the export has
    // to keep it whichever branch it takes: a neighbouring function decided it,
    // because that branch asked `plainData` for the *JSON* policy with a
    // `new Set()`. A write to one key then never reached the other.
    // The list is the module's own, which both dicts hold, so a push through
    // one is in the other and in Python.
    test('a shared list is one list', async () => {
        const { aliased, aliased_with_fn } = await mod();
        const before = aliased.b.length;

        expect(aliased.a).toBe(aliased.b);

        aliased.a.push(2);

        expect(aliased.b).toHaveLength(before + 1);
        expect(aliased_with_fn.b).toHaveLength(before + 1);
    });

    test('and a function beside it changes nothing for the data either', async () => {
        const { aliased_with_fn } = await mod();
        const before = aliased_with_fn.b.length;

        expect(aliased_with_fn.a).toBe(aliased_with_fn.b);

        aliased_with_fn.a.push(2);

        expect(aliased_with_fn.b).toHaveLength(before + 1);
        expect(aliased_with_fn.twice(21)).toBe(42);
    });

    // The export registers its own container, not only the values under it: a
    // key pointing back at the dict has to meet the object that is being handed
    // over, not a second copy of it.
    test('and a dict that points at itself comes out as itself', async () => {
        const { cyclic_with_fn } = await mod();

        expect(cyclic_with_fn.self).toBe(cyclic_with_fn);
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
