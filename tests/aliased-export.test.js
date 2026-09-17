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
    count
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
