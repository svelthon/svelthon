import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as python from './fixtures/crossing_bytes.py';
import BytesHost from './fixtures/BytesHost.svelte';

// bytes reach JavaScript as JavaScript holds bytes, a `Uint8Array` of them, at
// every door: what a `Blob`, a `fetch` body and a `TextDecoder` take. Raw, the
// Brython object was written into a `Blob` as "[object Object]", 15 bytes, in
// silence. No live object can be one (a view is refused or written as text,
// and Chrome refuses a typed array over a buffer that grows), so each is a copy
// of the bytes held at the crossing.
test('bytes and a bytearray cross as a Uint8Array at every door', () => {
    for (const bytes of [python.data, python.box.data, python.give()]) {
        expect(bytes).toBeInstanceOf(Uint8Array);
        expect([...bytes]).toEqual([97, 98]);
    }

    expect(python.buffer).toBeInstanceOf(Uint8Array);
    expect([...python.box.buffer]).toEqual([99, 100]);
    expect(python.handed()).toEqual([2, 'cd']);
});

// Handed back, bytes are the bytes again while the copy holds them still, and
// new bytes of what it holds once JavaScript wrote into it: a `Uint8Array` is
// writable, and the bytes it came from never change.
test('and come back to Python as the bytes they hold', () => {
    expect(python.same(python.data)).toBe(true);
    expect(python.back()).toBe(true);

    const written = python.give();
    written[0] = 120;

    expect(python.shown(written)).toBe("bytes:b'xb':False");
    expect(python.shown(python.give())).toBe("bytes:b'ab':True");
});

// A bytearray's copy is taken again at each change Python makes: by the export,
// as at a write of the name, and by a prop at the render the change causes. And
// what JavaScript writes into its copy comes back as a bytearray of it.
test('a bytearray is taken again when Python changes it', () => {
    python.grow();
    expect([...python.buffer]).toEqual([99, 100, 101]);

    const written = python.buffer;
    written[0] = 120;
    expect(python.shown(written)).toBe("bytearray:bytearray(b'xde'):False");

    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(BytesHost, { target });
    flushSync();

    const shown = () => target.querySelector('[data-k="bytes"]').textContent;

    expect(shown()).toBe('true 97,98');

    host.grow();
    flushSync();
    expect(shown()).toBe('true 97,98,99');
});
