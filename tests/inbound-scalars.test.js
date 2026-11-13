// @vitest-environment node
//
// One value, four doors, and they did not agree.
//
// Brython reads a whole JavaScript number as an `int` and a fractional one as a
// `JSObject`, so `0.5` arriving from JavaScript could multiply — arithmetic
// works on the raw number and hides everything — while `format(x, ".2f")`
// answered *non-empty format string passed to object.__format__*. The same 0.5
// returned by an imported *function* was a float, because that path already went
// through the conversion.
//
// `pyBind` was written for one of the four, a binding's write-back. It is the
// rule for all of them now, and `format` is the question that tells them apart.
import { test, expect, describe } from 'vitest';

describe('a scalar entering Python', () => {
    const mod = () => import('./fixtures/scalars_mod.py');

    test.for([
        ['an imported constant', 'as_constant'],
        ['a JavaScript call', 'as_result'],
        ['to_py', 'as_conversion'],
        ['and a Python literal, the control', 'as_literal']
    ])('%s formats like a float', async ([, name]) => {
        expect((await mod())[name]()).toBe('0.50');
    });

    test('an argument handed to an exported function too', async () => {
        expect((await mod()).formatted(0.5)).toBe('0.50');
    });

    // The conversion is Brython's, and it carries its own rules: past 2^53 a
    // number is the double it is, a float, as CPython reads that double.
    test('and a number past 2^53 is a float', async () => {
        expect((await mod()).as_big()).toBe('float');
    });
});
