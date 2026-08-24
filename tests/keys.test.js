import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Keys from './fixtures/Keys.svelte';

// An `{#each}` key is an expression, so it may hold parentheses of its own — a
// call, a builtin, a tuple. The pattern that used to find it could not, and when
// it failed it failed silently: the whole line was taken for the target, the key
// travelled into the markup uncompiled, and the names inside it were declared as
// the block's own.
describe('an {#each} key is compiled like every other expression', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Keys, { target });
        flushSync();

        return {
            row: (k) =>
                [...target.querySelectorAll(`[data-k="${k}"] li`)]
                    .map((n) => n.textContent)
                    .join(','),
            node: (k, id) => target.querySelector(`[data-k="${k}"] li[data-id="${id}"]`),
            click: () => {
                target.querySelector('button[data-k="touch"]').click();
                flushSync();
            }
        };
    };

    test('a key that calls one of the component’s own functions', () => {
        expect(setup().row('call')).toBe('AB-,CD-');
    });

    // `str` is Python's, and lives nowhere in the generated JavaScript: before
    // the key was compiled this reached the browser as `str is not defined`.
    test('a key that calls a builtin', () => {
        expect(setup().row('builtin')).toBe('AB-,CD-');
    });

    // The Python way to write a composite key, and the one shape that had no
    // workaround: a tuple is an array, so without repr() it is a fresh object on
    // every render and Svelte rejects it as `each_key_volatile`.
    test('a tuple key, which is how Python writes a composite one', () => {
        expect(setup().row('tuple')).toBe('2024-5,2024-6');
    });

    test('a key that calls a method on the row', () => {
        expect(setup().row('method')).toBe('AB,CD');
    });

    // The parenthesis that closes the key is inside a string, not at depth zero.
    test('a key holding a parenthesis in a string literal', () => {
        expect(setup().row('quoted')).toBe('AB,CD');
    });

    // The two shapes the scanner must keep telling apart: a parenthesised target
    // is not a key, and a parenthesised target may still be followed by one.
    test('a tuple target followed by a key', () => {
        expect(setup().row('destructured')).toBe('a,b');
    });

    test('a tuple target alone is a target, not a key', () => {
        expect(setup().row('bare')).toBe('a,b');
    });

    // What a key is *for*: reconciliation. A field no key reads changes, so every
    // key stays what it was and the nodes must survive.
    test('the keys are stable, so the rows are re-rendered and not recreated', () => {
        const { row, node, click } = setup();
        const kept = [node('call', 1), node('builtin', 1), node('tuple', 1)];

        click();

        expect(row('call')).toBe('AB!,CD-');
        expect(node('call', 1)).toBe(kept[0]);
        expect(node('builtin', 1)).toBe(kept[1]);
        expect(node('tuple', 1)).toBe(kept[2]);
    });
});
