// @vitest-environment node
//
// A function published under a second name.
//
// The compiler hands the module's *functions* over itself and its *values* to
// `pyExport`, and `alias = original` is a value. `pyExport` returned anything
// whose `typeof` is not `object` untouched, so the alias crossed as the bare
// Python function: calling it gave back a coroutine object, `await` on it gave
// the same object again — an `await` on a non-thenable is the value itself — and
// the body never ran. The counter is what says so; the shape alone looks fine.
//
// The witness that must not change — a function JavaScript built, published
// under a Python name, keeping the marks its library put on it — is
// `exported_js.py`, read by `module-exports.test.js`. Wrapping every function
// here would break that one, which is why the gate asks whether Python declared
// the signature rather than whether the value is callable.
import { test, expect, describe } from 'vitest';
import {
    original,
    alias,
    sync_original,
    sync_alias,
    count,
    bare,
    bare_alias,
    bare_mapping,
    spread,
    spread_alias
} from './fixtures/aliased_export.py';

describe('a function exported under a second name', () => {
    test('the name `def` gave it was never in doubt', async () => {
        const before = count();

        expect(await original()).toEqual({ answer: 42 });
        expect(count() - before).toBe(1);
    });

    test('and the alias runs its body too', async () => {
        const before = count();

        expect(await alias()).toEqual({ answer: 42 });
        expect(count() - before).toBe(1);
    });

    // The synchronous half: the return value has to be converted, or a dict
    // reaches JavaScript with its Brython internals.
    test('a synchronous alias converts what it returns', () => {
        expect(sync_alias('x')).toEqual(sync_original('x'));
        expect(sync_alias('x')).toEqual({ rows: [1], tag: 'x' });
    });
});

// The signature travels with the function, or it does not travel at all.
//
// Trimming a call to what Python declared is the boundary's contract, not
// Python's rule: it is what lets a framework hand an event to a handler that
// declares nothing. The name `def` gave a function kept it; the alias and the
// mapping reached a branch that called `pyCall` without the arity, so `Infinity`
// meant no trim and the same function raised on the argument it was given.
describe('a function that declares no parameter', () => {
    test.for([
        ['under its own name', () => bare],
        ['under an alias', () => bare_alias],
        ['in an exported mapping', () => bare_mapping.run]
    ])('takes the event a consumer hands it, %s', ([, reach]) => {
        expect(reach()('event')).toBe(42);
    });

    // And `*args` keeps taking everything: the trim is the declared arity, not
    // a cap.
    test.for([
        ['under its own name', () => spread],
        ['under an alias', () => spread_alias]
    ])('while *args still takes them all, %s', ([, reach]) => {
        expect(reach()(1, 2, 3)).toBe(3);
    });
});
