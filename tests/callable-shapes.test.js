// @vitest-environment node
//
// *Callable in Python* has three shapes, and the boundary knew two of them.
//
// A function, a bound method — learned at the pass that met `handler.save` — and
// an instance whose class defines `__call__`, which is an ordinary way to write a
// strategy object and which arrived as data. And the same bound method that a
// mapping adapts was not adapted when it was the exported value itself: `top =
// handler.run` beside `actions = {"default": handler.run}`, one Python object in
// two positions, one of them callable from JavaScript and the other not.
//
// The controls are what say the defect is at the boundary: the body answers from
// Python, and a lambda that calls it answers through the same crossing.
import { test, expect, describe } from 'vitest';
import {
    top,
    actions,
    instance_probe,
    method_probe,
    local_probe,
    wrapped_probe,
    instance_kind,
    two_instances
} from './fixtures/callables.py';

describe('a bound method exported under its own name', () => {
    // The position that already worked.
    test('is callable from a mapping', () => {
        expect(actions.default()).toBe(42);
    });

    test('and callable on its own', () => {
        expect(typeof top).toBe('function');
        expect(top()).toBe(42);
    });
});

describe('an instance whose class defines __call__', () => {
    test('answers from Python', () => {
        expect(local_probe()).toBe('aevent');
    });

    test('and through a lambda', () => {
        expect(wrapped_probe()).toBe('aevent');
    });

    test('and a bound method of the same object was never in doubt', () => {
        expect(method_probe()).toBe(42);
    });

    test('arrives as something JavaScript can call', () => {
        expect(instance_kind()).toBe('function');
        expect(instance_probe()).toBe('aevent');
    });

    // `__call__(self, suffix)` declares two parameters and the caller passes
    // one: the instance is not one of the arguments a caller counts.
    test('with its own receiver, and not another instance of its class', () => {
        expect(two_instances()).toEqual(['aevent', 'bevent']);
    });
});
