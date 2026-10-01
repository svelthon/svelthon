// **A quoted group value is the string its node holds.** Svelte builds the
// attribute and the compiler rebuilt the same value for the model, by rules of
// its own, three of which disagreed with the attribute's:
//
// - the end of the value was the first quote of its kind, so `value="{data["id"]}"`
//   was cut inside the interpolation and the model got the node's text;
// - a literal part was copied as written, so `a&amp;{n}` reached Python as
//   `a&amp;1` while the field held `a&1`;
// - an interpolation was joined with `String()`, so `a-{None}` was `a-None`
//   and `a-{False}` was `a-false`, where the field shows `a-` and `a-False`.
//
// The reference is the node of the same component, not a literal: the model must
// hold exactly what the field shows.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupValueText from './fixtures/GroupValueText.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(GroupValueText, { target });
    flushSync();

    const input = (key) => target.querySelector(`input[data-k="${key}"]`);

    return {
        instance,
        input,
        pick: (key) => {
            input(key).click();
            flushSync();

            return String(instance.held(key));
        }
    };
};

test.for(['nested-text', 'amp', 'numeric', 'nbsp', 'none-after', 'none-before', 'none-twice', 'false-after', 'false-twice'])(
    'the model holds what the %s field shows',
    (key) => {
        const { instance, input, pick } = setup();

        pick(key);
        expect(instance.text(key)).toBe(input(key).value);
    }
);

// A lone interpolation is the value itself, typed, quotes inside or not.
test.for([
    ['nested', '7'],
    ['none-alone', 'None']
])('a lone %s interpolation keeps its type', ([key, held]) => {
    expect(setup().pick(key)).toBe(held);
});

// And the value still follows what it is built from.
test('a value cut at the wrong quote no longer stops following', () => {
    const { instance, input, pick } = setup();

    pick('nested-text');
    instance.change();
    flushSync();

    expect(input('nested-text').value).toBe('item-8');
    expect(input('nested-text').checked).toBe(false);
});
