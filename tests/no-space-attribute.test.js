import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NoSpaceAttribute from './fixtures/NoSpaceAttribute.svelte';

// `<b title="y"onclick={go}>` is two attributes: HTML has always let one follow
// a quoted value with no space, and Svelte's parser follows HTML.
//
// Five sites decided where an attribute's name begins and two of them read a
// class that did not exclude the quote, so the name came back as `"y"onclick`,
// which matches no rule. Every rule at once was lost, and lost in silence: no
// error, no warning, a button that never fires and a page that looks right.
//
// Found by the eighteenth pass of the external audit, which called it the worst
// finding of the series for exactly that reason: every other one refused,
// crashed, or printed something a reader could see.
describe('an attribute with no space before it keeps every rule', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(NoSpaceAttribute, { target });
        flushSync();

        return {
            node: (k) => target.querySelector(`[data-k="${k}"]`),
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent
        };
    };

    test('a handler fires, as it does with the space', () => {
        const { node, read } = setup();

        node('spaced').click();
        flushSync();
        expect(read('count')).toBe('1');

        node('tight').click();
        flushSync();
        expect(read('count')).toBe('2');
    });

    // An empty Python list is false, and JavaScript calls it true.
    test('a class: is read for truthiness', () => {
        expect(setup().node('tight_class').classList.contains('on')).toBe(false);
    });
});
