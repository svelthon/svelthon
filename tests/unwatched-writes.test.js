// **A write to an object nobody watches asks nothing but whether it is
// watched.** Every write by subscript and every attribute write in the program
// comes through the runtime, so what each one asks is paid everywhere. A write
// by subscript asked the object's type before asking whether anything watched
// it, and an attribute write whether the object was a class: one type read off
// the descriptors per write (`ownType`), measured at +77 % on 200 000 writes to
// a local list. Counted here as those reads, which every type question of the
// runtime makes: they must not grow with the writes.
import { test, expect } from 'vitest';
import { write } from './fixtures/unwatched_writes.py';

const typesRead = (n) => {
    const describe = Object.getOwnPropertyDescriptor;
    let read = 0;

    Object.getOwnPropertyDescriptor = (one, name) => {
        if (name === 'ob_type') read += 1;
        return describe(one, name);
    };

    try {
        expect(write(n)).toBe(3 * (n - 1));
    } finally {
        Object.getOwnPropertyDescriptor = describe;
    }

    return read;
};

test('writes by subscript and by attribute to objects nobody watches read no type', () => {
    expect(typesRead(2000)).toBe(typesRead(1000));
});
