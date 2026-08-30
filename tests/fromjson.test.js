import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import FromJson from './fixtures/FromJson.svelte';

// `fromjson` is the mirror of `tojson`, and what it has to produce is *real*
// Python: a JavaScript object read as one answers `.type` and nothing else.
describe('fromjson', () => {
    const read = (key) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(FromJson, { target });
        flushSync();
        return target.querySelector(`p[data-k="${key}"]`).textContent;
    };

    test('the result is a dict', () => expect(read('is_dict')).toBe('True'));
    test('.get() works on it', () => expect(read('got')).toBe('Fragment'));
    test('.items() works on it', () => expect(read('pairs')).toBe('4'));

    // The trap this exists for: on an unconverted object `.items` reads the key
    // rather than the method, so the failure depends on the payload.
    test('a key named "items" stays a key', () => expect(read('collides')).toBe('42'));

    test('a nested object is a dict too', () => expect(read('nested')).toBe('True'));
    test('an array becomes a list', () => expect(read('listed')).toBe('True'));
    test('an object inside an array is a dict', () => expect(read('inside')).toBe('True'));
    test('a scalar crosses unchanged', () => expect(read('scalar')).toBe('2'));

    // What `await res.json()` hands back is parsed already.
    test('an already parsed value is walked too', () => expect(read('same')).toBe('1'));
    test('null becomes None', () => expect(read('empty')).toBe('True'));
});
