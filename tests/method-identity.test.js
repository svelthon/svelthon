import { test, expect } from 'vitest';

// A method read off its class under a name the runtime follows, a mutator's
// name, `__setattr__` or `__getattribute__`, was wrapped anew at every read:
// `Cart.add is Cart.add` was False, a set of two reads held two methods, and
// `Box.__getattribute__ is object.__getattribute__`, the way to ask whether a
// class redefines its reads, was False. Two reads of `box.__setattr__` were
// unequal, a method-wrapper comparing by the function it wraps, and what a read
// handed back was not what the class's dictionary holds. The builtin mutators
// are followed where the engine keeps them, and a read hands back the engine's
// own object.
test('a method read off its class is itself, as CPython reads it', async () => {
    const { answers } = await import('./fixtures/method_identity.py');

    expect([...answers()]).toEqual(['True', 'True', '1', 'True', 'True', 'True', 'True', 'True', 'True', 'True', 'True']);
});
