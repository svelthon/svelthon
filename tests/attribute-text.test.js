// A value alone in an attribute of text is written as Python writes it, as it
// is with text around it: one value, one rendering. What has a meaning of its
// own to an attribute stays Svelte's: None the absence, a boolean its
// presence, `class` its classes, a `value` the one a binding compares.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import AttributeText from './fixtures/AttributeText.svelte';

test.for([
    ['list', 'title', '[1, 2]'],
    ['tuple', 'title', '(1,)'],
    ['dict', 'data-v', "{'a': 1}"],
    ['float', 'title', '1.0'],
    ['instance', 'title', 'Point(3)'],
    ['quoted', 'title', '[1, 2]'],
    ['shorthand', 'name', 'x'],
    ['spread', 'title', '[1, 2]'],
    ['spread', 'data-price', '1.0'],
    ['int', 'title', '3'],
    ['bool', 'aria-pressed', 'true'],
    ['none', 'title', null],
    ['class', 'class', 'a b']
])('#%s has %s %s', ([id, name, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AttributeText, { target });
    flushSync();

    expect(target.querySelector(`#${id}`).getAttribute(name)).toBe(expected);
});

test('a value keeps the number a binding compares', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AttributeText, { target });
    flushSync();

    expect(target.querySelector('#value').value).toBe('1');
});
