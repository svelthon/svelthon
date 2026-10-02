// **A function reached through an imported object is an imported function.**
// `invoke(done)` adapted its callback and `Tools.invoke(done)` did not: the
// namespace crossed as an object and its member was called by the engine's own
// interop, so a callback that takes nothing raised on the library's argument
// and a callable instance was not a function at all.
//
// What the member keeps is the other half: its receiver, its identity across
// reads, the live binding of a module, and a class among the members.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ImportMembers from './fixtures/ImportMembers.svelte';

const setup = () => {
    const instance = mount(ImportMembers, { target: document.body.appendChild(document.createElement('div')) });
    flushSync();

    return instance;
};

test.for(['function', 'bound', 'instance'])('a %s handed to a namespace member is adapted', (kind) => {
    const instance = setup();

    expect(instance.through_namespace(kind)).toBe(42);
    expect(instance.through_default(kind)).toBe(42);
});

test('a member keeps its object as receiver, at any depth', () => {
    const instance = setup();

    expect(instance.receiver()).toBe('n:x');
    expect(instance.nested()).toBe(30);
});

test('is one function across reads, and reads the live binding', () => {
    const instance = setup();

    expect(instance.same()).toBe(true);
    expect(Array.from(instance.live())).toEqual(['first', 'second']);
});

test('and a class among the members is still constructed', () => {
    expect(setup().constructed()).toBe(42);
});

// Every operation through which an object of a library meets a Python
// callback. Marking the objects that lead to one covered a path at a time;
// the engine's own conversion of a Python callable is the one site now.
describe.for(['function', 'bound', 'instance'])('a %s', (kind) => {
    test('handed to a constructor', () => {
        expect(Array.from(setup().constructor_callback(kind))).toEqual([42, 42]);
    });

    test('handed to an object a promise resolved to', async () => {
        expect(await setup().resolved(kind)).toBe(42);
    });

    test('written as a property, held in an array, nested in options', () => {
        expect(Array.from(setup().other_positions(kind))).toEqual([42, 42, 42]);
    });
});

// Reading a property is one read: a getter that consumes what it reads lost
// a value to a read made only to decide what the value was.
test('a property is read once', () => {
    expect(setup().read_once()).toBe('A');
});

test('and one callback is one function, directly and through a member', () => {
    expect(setup().one_identity()).toBe(1);
});
