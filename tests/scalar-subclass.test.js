// @vitest-environment node
//
// A value that *is* a number crosses as its number, whatever class it wears.
//
// A Brython float is an object holding a number, and three converters asked
// whether a value was one by **identity**: `ob_type === float`. A subclass has a
// class of its own, so it answered no, the walk took it for an instance, and
// published its attributes — of which `class Price(float): pass` has none. The
// number reached JavaScript as `{}` and the JSON was valid.
//
// Nothing was lost in Python, which is the half that made it quiet: `format(p,
// ".2f")` and `p + 0.25` kept working, so a component's own display was right
// while what it handed out was empty.
//
// Asked of the MRO now, which begins at the class itself, so the exact type and
// the subclass take one road. The same hole was measured the same day on `int`
// and `str` subclasses, and they are here for that reason rather than because an
// audit asked: a question answered for one builtin is answered for its
// neighbours or it will be asked again.
import { test, expect, describe } from 'vitest';
import {
    price,
    count,
    label,
    plain_float,
    plain_int,
    plain_str,
    carried,
    held,
    reads_python,
    as_json
} from './fixtures/scalar_subclass.py';

describe('a subclass of a builtin scalar', () => {
    test.for([
        ['a float', price, 0.25],
        ['an int', count, 3],
        ['a str', label, 'x']
    ])('crosses as the value it is, %s', ([, got, expected]) => {
        expect(got).toBe(expected);
    });

    // The controls: the exact types, which were never in doubt and which the
    // repair must not have changed.
    test.for([
        ['a float', plain_float, 0.25],
        ['an int', plain_int, 3],
        ['a str', plain_str, 'x']
    ])('as the exact type already did, %s', ([, got, expected]) => {
        expect(got).toBe(expected);
    });

    // Inside a container, where the walk meets it rather than the export.
    test('and inside what holds it', () => {
        expect(held.amount).toBe(0.25);
        expect(held.rows[0]).toBe(3);
    });

    test('and through the serialiser', () => {
        expect(as_json()).toEqual(['0.25', '{"amount":0.25,"rows":[3]}', '0.25']);
    });
});

// What such a value does *not* carry across, said rather than discovered: a
// subclass may hold fields, and they stay in Python with the object. It is the
// same sentence a callable gets — a value crosses as what it *is*, not as what
// it holds beside that.
describe('a subclass carrying a field of its own', () => {
    test('crosses as its number', () => {
        expect(carried).toBe(0.25);
    });

    test('while Python keeps the whole object', () => {
        expect(reads_python()).toEqual([true, '0.25', 0.5, 'EUR']);
    });
});
