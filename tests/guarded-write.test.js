import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GuardedWrite from './fixtures/GuardedWrite.svelte';

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
