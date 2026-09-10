import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BoundTargets from './fixtures/BoundTargets.svelte';

// `bind:` used to be the one directive left in JavaScript, because it needs to
// read *and* write and no single expression does both. Svelte takes a pair for
// exactly that, so the value is now compiled twice — once as an expression, once
// as an assignment target — and a binding can name something other than a name.
describe('bind: on a target that is not a bare name', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BoundTargets, { target });
        flushSync();

        const field = (k) => target.querySelector(`input[data-k="${k}"]`);

        return {
            field,
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            type: (k, value) => {
                const input = field(k);

                input.value = value;
                input.dispatchEvent(new window.Event('input', { bubbles: true }));
                flushSync();
            }
        };
    };

    test('an attribute is read into the field', () => {
        expect(setup().field('attr').value).toBe('ada');
    });

    test('typing writes back through the attribute', () => {
        const { read, type } = setup();

        type('attr', 'grace');
        expect(read('attr-echo')).toBe('grace');
    });

    test('an item is read into the field', () => {
        expect(setup().field('item').value).toBe('3');
    });

    test('typing writes back through the item', () => {
        const { read, type } = setup();

        type('item', '42');
        expect(read('item-echo')).toBe('42');
    });

    // The dot finds a key in a template expression, so the write has to land in
    // the same key — otherwise reading `sizes.width` and typing into it disagree,
    // silently: Brython would set a JavaScript property on the dict and the
    // field would snap back on the next render.
    test('the dot writes where it read, on a dict', () => {
        const { field, read, type } = setup();

        expect(field('dot').value).toBe('3');
        type('dot', '7');
        expect(read('item-echo')).toBe('7');
    });

    test('the dot and the subscript reach the same key', () => {
        const { field, type } = setup();

        type('item', '12');
        expect(field('dot').value).toBe('12');
    });

    test('a row of an {#each} binds to its own item', () => {
        const { field, read, type } = setup();

        expect(field('row-0').value).toBe('a');
        type('row-1', 'z');
        expect(read('rows-echo')).toBe('a, z');
    });
});
