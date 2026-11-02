// Whitespace before an attribute's `=`, which Svelte allows as it allows it
// after. The walk read `name=` only: at the space after `bind:value` it took
// the name for a shorthand and expanded it, so Svelte refused the tag,
// `Expected token >`, and before a quoted value it found no name at all, so
// `disabled = "{items}"` handed Svelte the list, which JavaScript calls true,
// and the button stayed disabled with `items` empty.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpacedEquals from './fixtures/SpacedEquals.svelte';
import SpacedValueNames from './fixtures/SpacedValueNames.svelte';
import SpacedValueNamesNative from './fixtures/SpacedValueNamesNative.svelte';

test('an attribute with whitespace before its `=` keeps every rule', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const component = mount(SpacedEquals, { target });
    const node = (k) => target.querySelector(`[data-k="${k}"]`);
    const read = () => {
        flushSync();

        return [
            node('disabled').disabled,
            node('hidden').hidden,
            node('class').classList.contains('active'),
            node('style').style.color,
            node('glued').style.color
        ];
    };

    expect(read()).toEqual([false, false, false, 'blue', 'red']);

    component.toggle();
    expect(read()).toEqual([true, true, true, 'red', 'red']);

    component.toggle();
    expect(read()).toEqual([false, false, false, 'blue', 'red']);

    node('click').click();
    node('bound').value = 'Bob';
    node('bound').dispatchEvent(new Event('input'));
    flushSync();

    expect([node('click').textContent, node('name').textContent]).toEqual(['1', 'Bob']);
});

// A value set apart from its `=` is the value, never the attribute it names:
// read as the shorthand `{value}`, `title = {value}` bound the title's value to
// the group, so the box was not checked and a click wrote `zz` into the list.
test('a value set apart from its `=` names no attribute, as in Svelte', () => {
    const seen = [SpacedValueNames, SpacedValueNamesNative].map((Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();

        const at = (k, tag) => target.querySelector(`[data-k="${k}"] ${tag}`);
        const read = () => ({
            boxes: ['value before', 'type before', 'checked after'].map((k) => at(k, 'input').checked),
            select: [at('select', 'select').multiple, at('select', 'select').value],
            title: target.querySelector('[data-k="directive word"]').title,
            picked: target.querySelector('[data-k="picked"]').textContent
        });
        const before = read();

        at('value before', 'input').click();
        flushSync();

        return [before, read()];
    });

    expect(seen[0]).toEqual(seen[1]);
});
