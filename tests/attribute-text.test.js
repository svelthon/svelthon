// A value alone in an attribute of text is written as Python writes it, as it
// is with text around it: one value, one rendering. What has a meaning of its
// own to an attribute stays Svelte's: None the absence, a boolean its
// presence, `class` its classes, a `value` the one a binding compares.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import AttributeText from './fixtures/AttributeText.svelte';
import AttributeTextRaises from './fixtures/AttributeTextRaises.svelte';
import AttributeTextRaisesOn from './fixtures/AttributeTextRaisesOn.svelte';
import AttributeNestedOuter from './fixtures/AttributeNestedOuter.svelte';
import AttributeNestedInner from './fixtures/AttributeNestedInner.svelte';

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
    ['overriding', 'title', 'Published'],
    ['enumerated', 'translate', 'no'],
    ['enumerated', 'draggable', 'false'],
    ['enumerated-spread', 'translate', 'no'],
    ['enumerated-spread', 'draggable', 'false']
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
        element('default').selectedIndex,
        [...element('default-case').selectedOptions].map((one) => one.textContent)
    ]).toEqual(['1', 0.25, 0.25, 0.25, 1, ['Two', 'Three']]);
});

// The text is written as an attribute, whatever property the element has of
// that name: an enumerated attribute's property, `translate` or `draggable`,
// made a truth of an object, turned them on.
test('a text an element has a property of keeps its meaning', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(AttributeText, { target });
    flushSync();

    const element = (id) => target.querySelector(`#${id}`);

    expect([element('enumerated').translate, element('enumerated').draggable, element('enumerated-spread').translate]).toEqual([false, false, false]);
});

// A text that raises raises where it is written, as Python's error, its class
// and its message kept.
test('a value whose text raises raises its error where the attribute is written', () => {
    const target = document.body.appendChild(document.createElement('div'));

    expect(() => {
        mount(AttributeTextRaises, { target });
        flushSync();
    }).toThrow(/ValueError: caption unavailable/);
});

// On a property Svelte sets to a boolean too, `translate`, `draggable` or
// `spellcheck`, which took the held error for true and raised nothing, by
// name, in a spread, and on a `<svelte:element>`, a spread written after it
// with no such key among them; but for one an attribute or a spread written
// after it overrides.
test.for([
    ['translate', true],
    ['draggable', true],
    ['spellcheck', true],
    ['spread', true],
    ['spread-then-attribute', true],
    ['element', true],
    ['element-spread', true],
    ['attribute-then-empty-spread', true],
    ['attribute-then-other-spread', true],
    ['between-spreads', true],
    ['element-attribute-then-spread', true],
    ['call-then-spread', true],
    ['spread-overridden', false],
    ['attribute-overridden', false],
    ['spread-overridden-by-spread', false],
    ['attribute-overridden-two-spreads-on', false]
])('a text that raises on %s raises: %s', ([way, raises]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const mounted = () => {
        mount(AttributeTextRaisesOn, { target, props: { way } });
        flushSync();
    };

    if (raises) expect(mounted).toThrow(/ValueError: caption unavailable/);
    else expect(mounted).not.toThrow();
});

// What an element keeps of its attributes is its own: a page mounted in a
// spread's value, whose spread overrode a text that raised, left the outer
// element raising it.
test("a page mounted in a spread's value leaves the element its own attributes", () => {
    const describe = () => {
        const inner = document.createElement('div');

        mount(AttributeNestedInner, { target: inner });

        return { 'data-preview': inner.querySelector('p').title };
    };
    const target = document.body.appendChild(document.createElement('div'));

    mount(AttributeNestedOuter, { target, props: { describe } });
    flushSync();

    const p = target.querySelector('p');

    expect([p.title, p.dataset.preview]).toEqual(['Outer caption', 'Chosen']);
});
