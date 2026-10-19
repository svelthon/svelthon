// **A snippet argument is read again where Svelte reads it again.** Svelte
// holds a `{@render}` argument that calls something until what it read
// changes, and reads any other again at each read of its parameter. Svelthon
// held both, twice: the argument, the call of its expression's function, which
// Svelte holds, and the bare parameter, in a derived of its own. So
// `{@render card(source.value)}`, `source` a value outside Svelte's signals,
// kept showing its first value after a click that Svelte's own snippet shows.
// The witness is the same component in Svelte, and an argument that calls
// something is held in both.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import '../src/lib/compile.cjs';
import SnippetRefresh from './fixtures/SnippetRefresh.svelte';
import SnippetRefreshNative from './fixtures/SnippetRefreshNative.svelte';
import { reset } from './fixtures/refresh_source.js';

const shown = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    reset();
    mount(Component, { target, props: { kind } });
    flushSync();

    const before = target.querySelector('output').textContent;

    target.querySelector('button').click();
    flushSync();

    return [before, target.querySelector('output').textContent];
};

test.for([
    ['attribute', ['10', '21']],
    ['call', ['10', '11']]
])('a snippet argument is read again where Svelte reads it again: %s', ([kind, expected]) => {
    expect([shown(SnippetRefresh, kind), shown(SnippetRefreshNative, kind)]).toEqual([expected, expected]);
});

// A bare parameter is no cell of the markup's, and Svelte refuses to bind its
// own parameter: refused, where a write would land on nothing.
test('a bare snippet parameter cannot be bound', () => {
    expect(() => pythonExpressions('{#snippet card(x)}<input bind:value={x} />{/snippet}', collector([]))).toThrow(
        '`x` is a parameter of its snippet'
    );
});
