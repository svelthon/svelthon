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
    bundled
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
