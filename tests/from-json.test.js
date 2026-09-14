import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import FromJson from './fixtures/FromJson.svelte';

// `to_js` and `to_py` are the two directions of the same bridge, and
// `tojson`/`from_json` are those two with the dump and the parse attached. What
// the inbound half has to produce is *real* Python: an unconverted JavaScript
// object answers `.type` and nothing else.
describe('the inbound bridge', () => {
    const read = (key) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(FromJson, { target });
        flushSync();
        return target.querySelector(`p[data-k="${key}"]`).textContent;
    };

    describe('from_json', () => {
        test('the result is a dict', () => expect(read('is_dict')).toBe('True'));
        test('.get() works on it', () => expect(read('got')).toBe('Fragment'));
        test('.items() works on it', () => expect(read('pairs')).toBe('4'));

        // The trap this exists for: on an unconverted object `.items` reads the
        // key rather than the method, so the failure depends on the payload.
        test('a key named "items" stays a key', () => expect(read('collides')).toBe('42'));

        test('a nested object is a dict too', () => expect(read('nested')).toBe('True'));
        test('an array becomes a list', () => expect(read('listed')).toBe('True'));
        test('an object inside an array is a dict', () => expect(read('inside')).toBe('True'));
        test('a scalar crosses unchanged', () => expect(read('scalar')).toBe('2'));
        test('null becomes None', () => expect(read('empty')).toBe('True'));

        // A root that is an array, which no method on an object can speak for.
        test('a root array becomes a list', () => expect(read('rooted_kind')).toBe('list'));
        test('so it takes a slice', () => expect(read('rooted_slice')).toBe('[1]'));
        test('and its own arrays are lists too', () =>
            expect(read('rooted_inner')).toBe('True'));
    });

    describe('to_py', () => {
        // What `await res.json()` hands back is parsed already, so this is the
        // half a component reaching into `js.` by hand actually needs.
        test('a JavaScript object becomes a dict', () => expect(read('converted_dict')).toBe('True'));
        test('it walks arrays too', () => expect(read('converted_list')).toBe('True'));
        test('it agrees with from_json on the same payload', () => expect(read('agree')).toBe('True'));
        test('a value that needs nothing is returned as it is', () =>
            expect(read('plain')).toBe('already a string'));

        // The guard is put where the data *might* be JavaScript's, so it runs on
        // Python's too. A Brython tuple is a JavaScript array, and the array
        // branch rebuilt it as a list: the immutability went, and with it the
        // right to be a dict key.
        test('a tuple stays a tuple', () => expect(read('kept_kind')).toBe('tuple'));
        test('and a list is the same list, not a copy', () =>
            expect(read('kept_list')).toBe('True'));
        test('while an array that really is JavaScript becomes a list', () =>
            expect(read('foreign_kind')).toBe('list'));
    });
});
