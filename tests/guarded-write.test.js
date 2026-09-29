import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GuardedWrite from './fixtures/GuardedWrite.svelte';
import GuardedLookup from './fixtures/GuardedLookup.svelte';

// The same holds for the lookup that decides where the dot reads and writes: an
// exception a `__getitem__` raises is its author's answer, not "no such key".
// Only an absence the protocol states (a KeyError, an IndexError, no
// `__getitem__` at all) sends the dot on to the attribute.
describe('a lookup the object fails', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(GuardedLookup, { target });
        flushSync();
        return { target, instance };
    };

    test('keeps its own error on a read', () => {
        const { target } = setup();

        expect(target.querySelector('[data-k="read"]').textContent).toBe('ValueError: READ_UNAVAILABLE');
    });

    test('and on a write, which lands nowhere else', () => {
        const { target, instance } = setup();
        const said = [];
        const heard = (event) => {
            said.push(String(event.error?.message ?? event.message));
            event.preventDefault();
        };

        window.addEventListener('error', heard);
        target.querySelector('button[data-k="write"]').click();
        window.removeEventListener('error', heard);
        flushSync();

        expect(said.join(' ')).toMatch(/READ_UNAVAILABLE/);
        expect(instance.model()).toBe('{}');
    });
});

// In a template the dot finds a key as well as an attribute, and writes where
// the read came from. The probe and the write shared one `try`, so an exception
// raised by the author's own `__setitem__` read as *no such key* and the write
// moved to an attribute instead.
//
// What that produced is worse than a lost error: an object whose `__setitem__`
// refuses every write ended up carrying `obj.name` beside the entry it had
// protected — the dot reading the new value, the subscript still reading the
// old. A refusal became two truths and no error.
//
// A handler's exception does not travel back out of `click()`: jsdom reports it
// as an error event on the window, which is where it is read from here.
describe('a write the object refuses', () => {
    const clicking = () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(GuardedWrite, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
        const said = [];
        const heard = (event) => {
            said.push(event.error ? String(event.error.message ?? event.error) : event.message);
            event.preventDefault();
        };

        window.addEventListener('error', heard);
        target.querySelector('button[data-k="write"]').click();
        window.removeEventListener('error', heard);
        flushSync();

        return { read, said };
    };

    test('says so instead of writing somewhere else', () => {
        const { said } = clicking();

        expect(said.join(' ')).toMatch(/LOCKED/);
    });

    test('and leaves the object as it was, read either way', () => {
        const { read } = clicking();

        expect(read('dotted')).toBe('original');
        expect(read('keyed')).toBe('original');
    });
});
