import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NoSpaceAttribute from './fixtures/NoSpaceAttribute.svelte';
import GluedAttributes from './fixtures/GluedAttributes.svelte';

// `<b title="y"onclick={go}>` is two attributes: HTML has always let one follow
// a quoted value with no space, and Svelte's parser follows HTML.
//
// Five sites decided where an attribute's name begins and two of them read a
// class that did not exclude the quote, so the name came back as `"y"onclick`,
// which matches no rule. Every rule at once was lost, and lost in silence: no
// error, no warning, a button that never fires and a page that looks right.
//
// The worst kind of defect for exactly that reason: every other kind refuses,
// crashes, or prints something a reader can see.
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

// The same after a spread, an attachment or a shorthand, whose braces the name
// was read across, `{**attrs}disabled`: the button stayed disabled and the
// paragraph hidden for an empty list, and a binding was refused,
// `bind_invalid_expression`. And after a value this pass writes braced, which
// Svelte refuses glued to the next attribute, `Expected token >`.
test('an attribute glued to a spread, an attachment, a shorthand or a lone value keeps every rule', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const component = mount(GluedAttributes, { target });
    const node = (k) => target.querySelector(`[data-k="${k}"]`);
    const truth = () => {
        flushSync();

        return [node('disabled').disabled, node('hidden').hidden, node('class').classList.contains('active'), node('quoted').hidden];
    };

    expect(truth()).toEqual([false, false, false, false]);
    component.toggle();
    expect(truth()).toEqual([true, true, true, true]);
    component.toggle();
    expect(truth()).toEqual([false, false, false, false]);

    node('bound').value = 'Bob';
    node('bound').dispatchEvent(new Event('input'));
    node('handler').click();
    flushSync();

    expect([
        node('name').textContent,
        node('handler').textContent,
        node('short').getAttribute('label'),
        node('short').title,
        node('action').dataset.mark
    ]).toEqual(['Bob', '1', 'l', 'literal', 'l']);
});
