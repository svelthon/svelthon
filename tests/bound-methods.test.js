// @vitest-environment node
//
// *Callable in Python* and *a JavaScript function* are not the same category.
//
// The boundary decided which values to adapt with `typeof value === 'function'`,
// and a Brython bound method is not one: it is `{ob_type: method, im_func,
// im_self}`. So `invoke(box.done)` handed a JavaScript library an object, which
// failed with `not a function` before the method body ever ran — while the same
// body called from Python, or reached through a lambda, answered 42.
//
// The receiver is the half an ordinary function does not have, and it shows in
// two places: the declared arity counts `self` and the caller does not, and two
// instances of one class must not share a wrapper.
import { test, expect, describe } from 'vitest';
import {
    method_probe,
    function_probe,
    wrapped_probe,
    python_method,
    method_kind,
    with_argument,
    two_receivers,
    listen_method,
    stop_method,
    emit,
    seen,
    actions,
    control,
    mixed,
    python_call
} from './fixtures/bound_methods.py';

describe('a bound method handed to JavaScript', () => {
    // The three controls, which is what says the defect was at the boundary and
    // not in the method.
    test('the same body answers from Python', () => {
        expect(python_method()).toBe(42);
    });

    test('and behind a lambda', () => {
        expect(wrapped_probe()).toBe(42);
    });

    test('and an ordinary function was never in doubt', () => {
        expect(function_probe()).toBe(42);
    });

    test('arrives as something JavaScript can call', () => {
        expect(method_kind()).toBe('function');
        expect(method_probe()).toBe(42);
    });

    // `def tag(self, suffix)` declares two parameters and the caller passes one.
    // The receiver is not one of the arguments a caller counts.
    test('and its receiver is not counted among the arguments', () => {
        expect(with_argument()).toBe('aevent');
    });

    // Two instances, one class. A cache keyed on the function alone would hand
    // the second instance the first one's wrapper.
    test('two receivers are two callbacks', () => {
        expect(two_receivers()).toEqual(['aevent', 'bevent']);
    });

    // And the identity that a registry needs: `box.note` read twice gives two
    // intermediate objects, so a cache keyed on those would never match and
    // `off` would never remove anything.
    test('and reading the same method twice gives one JavaScript function', () => {
        listen_method();
        emit();

        expect(seen()).toBe(1);

        stop_method();
        emit();

        expect(seen()).toBe(1);
    });
});
