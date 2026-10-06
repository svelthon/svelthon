import { test, expect } from 'vitest';
import * as python from './fixtures/crossing_bytes.py';

// bytes reach JavaScript as JavaScript holds bytes, a `Uint8Array` of them, at
// every door: what a `Blob`, a `fetch` body and a `TextDecoder` take. Raw, the
// Brython object was written into a `Blob` as "[object Object]", 15 bytes, in
// silence. A `bytearray` crosses as the bytes it holds at that moment.
test('bytes cross as a Uint8Array at every door', () => {
    for (const bytes of [python.data, python.box.data, python.give()]) {
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect([...bytes]).toEqual([97, 98]);
    }

    expect(python.buffer).toBeInstanceOf(Uint8Array);
    expect([...python.box.buffer]).toEqual([99, 100]);
    expect(python.handed()).toEqual([2, 'cd']);
});

// Handed back, bytes are the bytes again, as a view is its container.
test('and come back to Python as themselves', () => {
    expect(python.same(python.data)).toBe(true);
    expect(python.back()).toBe(true);
});
