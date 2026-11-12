// @vitest-environment node
//
// The server half of `prop-body-writes.test.js`: a write after a semicolon on
// a prop's annotation line is the child's own on a server as well.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PropSameLine from './fixtures/PropSameLine.svelte';

const shown = (props) => render(PropSameLine, { props }).body.replace(/<!--[^>]*-->/g, '');

test('a write after a semicolon on the annotation line renders on a server', () => {
    expect(shown({ text: ' given ', tally: 5, left: 'given', right: 'given', twice: 'given', bound: 'given' })).toBe(
        '<p>GIVEN|6|GIVEN|GIVEN|GIVEN!|GIVEN</p>'
    );
    expect(shown({})).toBe('<p>D|1|D|D|D!|D</p>');
});
