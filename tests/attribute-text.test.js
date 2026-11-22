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
    ['class', 'class', 'a b'],
    ['overridden', 'title', 'Published'],
    ['overriding', 'title', 'Published']
])('#%s has %s %s', ([id, name, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AttributeText, { target });
    flushSync();

    expect(target.querySelector(`#${id}`).getAttribute(name)).toBe(expected);
});

// A property Svelte sets to the value, by name, in a spread or on a
// `<svelte:element>`, takes the value as it is: a `volume` its number, a
// `defaultValue` the one its options are compared with.
test('a property Svelte sets keeps the value as it is', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const element = (id) => target.querySelector(`#${id}`);

    mount(AttributeText, { target });
    flushSync();

    expect([
        element('value').value,
        element('volume').volume,
        element('volume-spread').volume,
        element('volume-element').volume,
        element('default').selectedIndex
    ]).toEqual(['1', 0.25, 0.25, 0.25, 1]);
});
