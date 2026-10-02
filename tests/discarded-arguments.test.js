// **An argument a callable does not take is never read.** The arguments were
// converted before being trimmed to the arity, and converting asks whether a
// value is awaitable, which reads its `then`: a payload the callback discards
// could fail the call, and was observed by it. Trimmed first now, against the
// arity at the call for an instance, and only what is passed is converted.
import { test, expect } from 'vitest';
import * as mod from './fixtures/discarded_arguments.py';

const payload = () => {
    const seen = { reads: 0 };

    seen.value = {
        get then() {
            seen.reads += 1;
            throw new Error('a discarded payload was read');
        }
    };

    return seen;
};

test.for([
    ['a function taking nothing', () => mod.zero, 42],
    ['a bound method', () => mod.bound, 42],
    ['a callable instance', () => mod.instance, 42]
])('%s is called without reading what it discards', ([, callee, answer]) => {
    const extra = payload();

    expect(callee()(extra.value)).toBe(answer);
    expect(extra.reads).toBe(0);
});

test('one it takes is passed, and the next one is not read', () => {
    const extra = payload();

    expect(mod.one(7, extra.value)).toBe(7);
    expect(extra.reads).toBe(0);
});

// The witness: a variadic function takes everything, so everything is passed.
test('a variadic function still receives every argument', () => {
    expect(mod.variadic(1, 2, 3)).toBe(3);
});
