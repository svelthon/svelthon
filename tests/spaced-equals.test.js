// Whitespace before an attribute's `=`, which Svelte allows as it allows it
// after. The walk read `name=` only: at the space after `bind:value` it took
// the name for a shorthand and expanded it, so Svelte refused the tag,
// `Expected token >`, and before a quoted value it found no name at all, so
// `disabled = "{items}"` handed Svelte the list, which JavaScript calls true,
// and the button stayed disabled with `items` empty.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpacedEquals from './fixtures/SpacedEquals.svelte';

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
