// **An argument a callable does not take is never read.** The arguments were
// converted before being trimmed to the arity, and converting asks whether a
// value is a route event, which reads its fields, then copies its `params`: a
// payload the callback discards could fail the call, and was observed by it.
// Trimmed first now, against the arity at the call for an instance, its
// `__call__` resolved first when it is a descriptor, and only what is passed is
// converted.
import { test, expect } from 'vitest';
import * as mod from './fixtures/discarded_arguments.py';

// Every look at the payload counts, whatever the conversion reads: a property,
// a key test, a descriptor or the list of keys.
const payload = () => {
    const seen = { reads: 0 };
    const look = (answer) => {
        seen.reads += 1;

        return answer;
    };

    seen.value = new Proxy(
        {},
        {
            get: () => look(undefined),
            has: () => look(false),
            getOwnPropertyDescriptor: () => look(undefined),
            ownKeys: () => look([])
        }
    );

    return seen;
};

test.for([
    ['a function taking nothing', () => mod.zero, 42],
    ['a bound method', () => mod.bound, 42],
    ['a callable instance', () => mod.instance, 42],
    ['an instance whose __call__ is a property', () => mod.by_property, 42]
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

// The same through a `property`, whose getter is what says the function takes
// one: it is asked before anything is converted.
test('one a property hands back takes is passed, and the next one is not read', () => {
    const extra = payload();

    expect(mod.one_by_property(7, extra.value)).toBe(7);
    expect(extra.reads).toBe(0);
});

// The witness: a variadic function takes everything, so everything is passed.
test('a variadic function still receives every argument', () => {
    expect(mod.variadic(1, 2, 3)).toBe(3);
});
