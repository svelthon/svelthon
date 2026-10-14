// @vitest-environment node
//
// **A component written in Python is known as one before its first render**,
// so a server hands it the Python value from the first request. A parent that
// holds a child by a prop asks which language the child is to hand it a prop,
// and the child said so only when its own script ran, after a server had
// prepared its props: the first render of a Python child handed a `Price(0.5)`
// showed `float`, the next ones `Price`, as the browser does. A child written
// in JavaScript is still handed JavaScript's number.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import ColdChildHost from './fixtures/ColdChildHost.svelte';
import ColdChild from './fixtures/ColdChild.svelte';
import ColdChildNative from './fixtures/ColdChildNative.svelte';

test('a Python child held by a prop is handed the Python value from its first render on a server', () => {
    for (const time of ['first', 'second']) {
        expect(render(ColdChildHost, { props: { Child: ColdChild } }).body, time).toContain('<p>Price</p>');
    }

    expect(render(ColdChildHost, { props: { Child: ColdChildNative } }).body).toContain('<p>number</p>');
});
