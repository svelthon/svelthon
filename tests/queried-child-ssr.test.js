// @vitest-environment node
//
// The server half of `queried-child.test.js`: a server prepares the props of a
// child it takes for a JavaScript one, and the `Price` was a float there too.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import QueriedChild from './fixtures/QueriedChild.svelte';

test.for([['importjs'], ['module'], ['reexport']])('a Python child imported under a query, by %s, renders the Price on a server', ([mode]) => {
    expect(render(QueriedChild, { props: { mode } }).body.replace(/<!--[^>]*-->/g, '')).toContain('<output>Price|EUR</output>');
});
