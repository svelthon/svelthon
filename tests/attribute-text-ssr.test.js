// @vitest-environment node
//
// The server half of `attribute-text.test.js`: the server writes a value alone
// in an attribute of text as the browser does, as Python writes it.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import AttributeText from './fixtures/AttributeText.svelte';
import AttributeTextRaises from './fixtures/AttributeTextRaises.svelte';
import AttributeTextRaisesOn from './fixtures/AttributeTextRaisesOn.svelte';

// And as the browser does, a value an attribute written after it overrides is
// never written, an enumerated attribute keeps its text, and a `defaultValue`,
// however it is spelled, chooses its options.
test('a value alone in an attribute of text is written as Python writes it, on a server', () => {
    const { body } = render(AttributeText);
    const tag = (id) => body.match(new RegExp(`<[^>]*\\sid="${id}"[^>]*>`))?.[0] ?? '';
    const attribute = (id, name) => tag(id).match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

    expect([
        attribute('list', 'title'),
        attribute('tuple', 'title'),
        attribute('dict', 'data-v'),
        attribute('float', 'title'),
        attribute('instance', 'title'),
        attribute('quoted', 'title'),
        attribute('spread', 'data-price'),
        attribute('int', 'title'),
        attribute('none', 'title'),
        attribute('overridden', 'title'),
        attribute('overriding', 'title'),
        attribute('enumerated', 'translate'),
        attribute('enumerated-spread', 'draggable')
    ]).toEqual(['[1, 2]', '(1,)', "{'a': 1}", '1.0', 'Point(3)', '[1, 2]', '1.0', '3', undefined, 'Published', 'Published', 'no', 'false']);
    expect(body).toContain('<option value="0.75" selected="">Loud</option>');
    expect(body).toContain('<option value="2" selected="">Two</option><option value="3" selected="">Three</option>');
});

test('a value whose text raises raises its error on a server, as Python’s', () => {
    expect(() => render(AttributeTextRaises).body).toThrow(/ValueError: caption unavailable/);
});

// The same ways as the browser's, one answer each.
test.for([
    ['translate', true],
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
])('a text that raises on %s raises on a server: %s', ([way, raises]) => {
    const rendered = () => render(AttributeTextRaisesOn, { props: { way } }).body;

    if (raises) expect(rendered).toThrow(/ValueError: caption unavailable/);
    else expect(rendered).not.toThrow();
});
