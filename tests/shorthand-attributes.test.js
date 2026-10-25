// **An attribute written as the shorthand is one of its tag's attributes** for
// whatever reads them, as the walk expands `{checked}` into `checked={checked}`:
// skipped with the values, `{checked}` beside `bind:group` was given a second
// `checked`, which Svelte refused as `attribute_duplicate`, and a select made
// multiple by `{MULTIPLE}` wrote back its choices as a `JavascriptArray`, no
// list, once one was made.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ShorthandAttributes from './fixtures/ShorthandAttributes.svelte';

test('a shorthand attribute is read with its tag’s others: a group’s checked, a select’s multiple', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ShorthandAttributes, { target });
    flushSync();

    const select = target.querySelector('[data-k="select"]');
    const before = instance.kinds();

    select.options[1].selected = true;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect(before).toBe("list True ['one']");
    expect(instance.kinds()).toBe("list True ['one', 'two']");
});
