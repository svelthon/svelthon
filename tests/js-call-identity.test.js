// @vitest-environment node
//
// What a JavaScript function reads about its arguments besides their contents.
//
// Every crossing so far has been asked whether the *value* arrives right. These
// two are about identity, and each has its own lifetime: a callback has to be
// the same function across calls, and two arguments of one call have to be the
// same object when Python said they were.
//
// Both were invisible to a test that inspects each argument on its own: the
// contents and the types were right throughout.
import { test, expect, describe } from 'vitest';
import {
    listen,
    stop,
    emit,
    count,
    listen_other,
    other_count,
    aliased,
    bundled,
    direct_probe,
    nested_probe,
    listed_probe,
    depths_probe,
    listen_boxed,
    stop_boxed,
    boxed_count
} from './fixtures/js_calls.py';

describe('a Python callback handed to JavaScript', () => {
    // `pyHandler` built a fresh wrapper per crossing, so `off(handler)` passed a
    // function the registry had never seen and the listener stayed. The next
    // `listen()` then added a second, and one event ran the body twice: the
    // audit's counter read 1, 2, 4 where it should read 1, 1, 2.
    test('is removed by the name that added it', () => {
        listen();
        emit();

        expect(count()).toBe(1);

        stop();
        emit();

        expect(count()).toBe(1);
    });

    // The registry deduplicates by identity too, which is the same property read
    // from the other side.
    test('and adding it twice adds one listener', () => {
        listen();
        listen();

        const before = count();

        emit();

        expect(count() - before).toBe(1);

        stop();
    });

    // The witness: two Python functions are two JavaScript functions, and the
    // cache must not hand the second the first one's wrapper.
    test('while a different callback is a different listener', () => {
        listen();
        listen_other();

        const ours = count();
        const theirs = other_count();

        emit();

        expect(count() - ours).toBe(1);
        expect(other_count() - theirs).toBe(1);

        stop();
    });
});

// Where the callback sits in the argument, which used to decide its calling
// contract. `outbound` wrapped a function handed over directly and `plainData`
// handed the ones inside a container across untouched, so `direct(done)`
// answered 42 and `nested({"done": done})` raised on a positional argument the
// author never declared — for the same Python function, called by JavaScript
// with the same value.
describe('a callback inside an argument', () => {
    // The control, and the one that always worked.
    test('is adapted when it is handed over directly', () => {
        expect(direct_probe()).toBe(42);
    });

    test('and when it sits in an options object', () => {
        expect(nested_probe()).toBe(42);
    });

    test('and when it sits in a list', () => {
        expect(listed_probe()).toBe(84);
    });

    // The cache from the previous pass, read through the new path: the same
    // Python function at two depths of one argument is one JavaScript function.
    test('and the same callback at two depths is one function', () => {
        expect(depths_probe()).toBe(true);
    });

    // Which is what makes an options object usable for leaving as well as
    // joining: the registry has to be handed back the function it was given.
    test('so a registry entered through options can be left through options', () => {
        listen_boxed();

        const joined = boxed_count();

        emit();

        expect(boxed_count() - joined).toBe(1);

        stop_boxed();

        const left = boxed_count();

        emit();

        expect(boxed_count()).toBe(left);
    });
});

describe('two arguments of one call', () => {
    // `args.map(outbound)` converted each argument on its own, so one Python
    // list under two names became two arrays: a write through the first was
    // invisible through the second.
    test('are the same object when Python said they were', () => {
        expect(aliased()).toEqual({ same: true, observed: 1 });
    });

    // The witness, and the reason this is a missing memo rather than a rule: the
    // same graph inside a *single* argument was shared all along.
    test('which is what a graph inside one argument already did', () => {
        expect(bundled()).toEqual({ same: true, observed: 1 });
    });
});
