// Markup Svelte accepts renders as Svelte renders it: a Python comment at the
// end of an expression or of a block's head, a trailing comma in a pattern or
// a snippet's parameters, and directive-looking words inside a quoted value,
// which are text.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import MarkupEdges from './fixtures/MarkupEdges.svelte';

const at = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(MarkupEdges, { target });
    flushSync();
    return (key) => target.querySelector(`[data-k="${key}"]`);
};

test('a comment at the end of an expression', () => {
    expect(at()('comment').textContent).toBe('2');
});

test('a comment at the end of a block head', () => {
    expect(at()('each-comment').textContent).toBe('13');
});

test('a trailing comma in a pattern', () => {
    expect(at()('trailing').textContent).toBe('1234');
});

test('a trailing comma in a snippet’s parameters', () => {
    expect(at()('snippet').textContent).toBe('3');
});

test('directive-looking words inside a quoted value are its text', () => {
    expect(at()('quoted').value).toBe('a bind:foo let:item b');
});
