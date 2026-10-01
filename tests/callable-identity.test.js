// @vitest-environment node
//
// Who a callable *is*, on the JavaScript side of the boundary.
//
// One Python value must cross as one JavaScript function, or a registry that
// knows a callback by identity — every `off`, `unsubscribe` and deduplicating
// set — cannot do its work. The cache that holds that promise had one key for
// two kinds of value: the pair *receiver and function*, which is exactly right
// for a bound method, rebuilt at every read, and wrong for an instance whose
// class defines `__call__`.
//
// An instance is one object for its whole life, and the function that performs
// its call is not part of who it is. Two things followed from keying it on that
// function, and both are here:
//
// - replacing `Strategy.__call__` handed out a **second** wrapper, so the
//   registry could not remove the callback it had been given;
// - `handler` and `handler.__call__` — two Python values with two contracts —
//   shared whichever wrapper crossed first, so one of them ran the other's body.
//
// Each case builds its own class inside its own function, so no cache outlives
// the measurement and no case answers for another.
import { test, expect, describe } from 'vitest';
import {
    removed_after_replacement,
    removed_without_replacement,
    both_shapes,
    two_instances,
    native_removed,
    native_kept,
    two_receivers,
    two_operations,
    python_method,
    primitive_removed,
    primitive_receivers,
    primitive_wrapper
} from './fixtures/callable_identity.py';

describe('a callable instance handed to a registry', () => {
    test('can be removed after its class replaces __call__', () => {
        expect(removed_after_replacement()).toEqual([true, 0]);
    });

    // The witness: the same registration and removal with nothing replaced,
    // which worked throughout.
    test('as it can when nothing is replaced', () => {
        expect(removed_without_replacement()).toEqual([true, 0]);
    });

    // And two instances of one class stay two callbacks, which the pair already
    // guaranteed and must keep guaranteeing.
    test('and two instances of one class are two callbacks', () => {
        expect(two_instances()).toBe(2);
    });
});

// The instance and its own bound method are two values, and the order they
// cross in must not decide what either becomes.
describe.for([
    ['the instance first', true],
    ['the bound method first', false]
])('an instance and its own `__call__`, %s', ([, order]) => {
    test('are two callbacks, each keeping its own body', () => {
        const [held, answers] = both_shapes(order);

        expect(held).toBe(2);

        // The bound method kept the function it was read from; the instance
        // follows the class, which now answers 2.
        expect(answers).toEqual([1, 2]);
    });
});

// The third representation, and the one an author reaches for without thinking
// about it: a builtin bound to a receiver. Brython builds `rows.append` fresh on
// every read, and it took the plain-function road, where the key is the function
// handed over — so two reads were two JavaScript functions, `off(rows.append)`
// found nothing, and the next event appended a second time to a list the author
// believed had stopped listening.
//
// Its identity is the pair, like an ordinary bound method: the receiver, and the
// operation, which is the signature record the native function carries.
describe('a native bound method handed to a registry', () => {
    test('is removed by a second read of the same method', () => {
        expect(native_removed()).toEqual([true, 0, []]);
    });

    // The witness, which always worked: the method read once and held in a name.
    test('as it is when the method was held in a name', () => {
        expect(native_kept()).toEqual([true, 0, []]);
    });

    // And the two halves of the pair, each on its own: one operation on two
    // receivers, and two operations on one receiver.
    test('and two lists keep two callbacks', () => {
        expect(two_receivers()).toEqual([2, [9], [9]]);
    });

    test('and two operations on one list keep two callbacks', () => {
        expect(two_operations()).toBe(2);
    });

    // The control: the shape that was already keyed this way.
    test('beside an ordinary bound method, which always was', () => {
        expect(python_method()).toEqual([true, 0, []]);
    });
});

// The same pair when the receiver is a JavaScript primitive, which no WeakMap
// accepts: `"hello".upper` was a new callback at each read, and `(7).__str__`,
// a method-wrapper, failed to cross at all with *Invalid value used as weak map
// key*.
describe('a method bound to a primitive', () => {
    test('is removed by a second read of the same method', () => {
        expect(primitive_removed()).toEqual([true, 0]);
    });

    test('and two strings keep two callbacks', () => {
        expect(primitive_receivers()).toEqual([2, ['ONE', 'TWO']]);
    });

    test('and an int’s special method crosses, once', () => {
        expect(primitive_wrapper()).toEqual([1, ['7']]);
    });
});
