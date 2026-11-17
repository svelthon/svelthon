// @vitest-environment node
//
// The server half of a Python parent's snippet rendered by a Python child. A
// server hands a snippet values rather than reads, crossed before the call, so
// the snippet takes back the ones it was handed as it announces itself, by
// position; a JavaScript parent's snippet is still handed JavaScript's.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SnippetPythonParent from './fixtures/SnippetPythonParent.svelte';
import SnippetPythonChildHost from './fixtures/SnippetPythonChildHost.svelte';
import SnippetPythonParentShapes from './fixtures/SnippetPythonParentShapes.svelte';
import SnippetPythonChildShapesHost from './fixtures/SnippetPythonChildShapesHost.svelte';
import LazyDoorsParent from './fixtures/LazyDoorsParent.svelte';

test.for(['bare', 'alias', 'dict', 'box', 'getter', 'nested', 'held'])('a Python parent snippet rendered %s on a server keeps its values', (kind) => {
    expect(render(SnippetPythonParent, { props: { kind } }).body).toContain('float:1.0|Price|Label');
    expect(render(SnippetPythonChildHost, { props: { kind } }).body).toContain('number:1|number|string');
});

// A pattern and a default too, which the snippet takes apart from the values it
// takes back, and not from the ones that crossed.
test('a Python parent snippet taking its arguments apart on a server keeps their values', () => {
    expect(render(SnippetPythonParentShapes, { props: { shape: 'pattern' } }).body).toContain('float:1.0|Price|Label');
    expect(render(SnippetPythonParentShapes, { props: { shape: 'default' } }).body).toContain('float|Price|Label');
    expect(render(SnippetPythonChildShapesHost, { props: { shape: 'pattern' } }).body).toContain('number:1|number|string');
    expect(render(SnippetPythonChildShapesHost, { props: { shape: 'default' } }).body).toContain('number|number|string');
});

// An iterable made as it goes, a generator, an iterator, a range, crosses to a
// Python reader whole, as a snippet's argument, a prop, a spread or a
// context's value: the server crossed it before the call, and the list made at
// the door left an iterator used up and a generator another object.
test.for(['snippet', 'prop', 'spread', 'context'])('an iterable made as it goes reaches a Python reader whole on a server, as a %s', (route) => {
    const seen = ['generator', 'iterator', 'range'].map((kind) => render(LazyDoorsParent, { props: { route, kind } }).body.match(/<output>(.*?)<\/output>/)?.[1]);

    expect(seen).toEqual(['generator same=True [1, 2, 3]', 'list_iterator same=True [1, 2, 3]', 'range same=True [1, 2, 3]']);
});
