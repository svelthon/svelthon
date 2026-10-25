// @vitest-environment node
//
// The server half of `shorthand-attributes.test.js`: the component compiles
// for the server too, where `{checked}` beside `bind:group` was given a second
// `checked` and refused, and the box is checked once.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import ShorthandAttributes from './fixtures/ShorthandAttributes.svelte';

test('the server renders a shorthand checked beside bind:group once', () => {
    const box = render(ShorthandAttributes).body.match(/<input[^>]*>/)[0];

    expect(box.match(/\schecked(=|\s|\/|>)/g)).toHaveLength(1);
});
