// @vitest-environment node
//
// The server half of `attribute-text.test.js`: the server writes a value alone
// in an attribute of text as the browser does, as Python writes it.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import AttributeText from './fixtures/AttributeText.svelte';

// And as the browser does, a value an attribute written after it overrides is
// never made text, and a `defaultValue` chooses its option.
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
        attribute('overriding', 'title')
    ]).toEqual(['[1, 2]', '(1,)', "{'a': 1}", '1.0', 'Point(3)', '[1, 2]', '1.0', '3', undefined, 'Published', 'Published']);
    expect(body).toContain('<option value="0.75" selected="">Loud</option>');
});
