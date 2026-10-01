// Markup Svelte accepts renders as Svelte renders it: a Python comment at the
// end of an expression or of a block's head, a trailing comma in a pattern or
// a snippet's parameters, and directive-looking words inside a quoted value,
// which are text.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import MarkupEdges from './fixtures/MarkupEdges.svelte';
import CommentDelimiters from './fixtures/CommentDelimiters.svelte';
import QuotedOptions from './fixtures/QuotedOptions.svelte';

test('an option written in a string of a script is left as the author wrote it', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(QuotedOptions, { target });
    flushSync();

    expect(target.querySelector('[data-k="example"]').textContent).toBe(
        '<svelte:options customElement="quoted-example" />'
    );
    expect(target.querySelector('[data-k="attribute"]').title).toBe(
        '<svelte:options customElement="quoted-attribute" />'
    );
});

test('comment delimiters inside a script are the author text', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(CommentDelimiters, { target });
    flushSync();
    const text = (key) => target.querySelector(`[data-k="${key}"]`).textContent;

    expect([text('wrapped'), text('opened'), text('reached')]).toEqual(['<!-- kept -->', '<!--', '42']);
});

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

// A comment in a binding's expression leaves both halves: the write reaches
// the model, on a name as on an attribute.
test('a comment in a binding leaves the write to the model', () => {
    const q = at();

    for (const [key, value] of [['bound-name', 'typed'], ['bound-label', 'shown']]) {
        q(key).value = value;
        q(key).dispatchEvent(new Event('input', { bubbles: true }));
    }
    flushSync();

    expect(q('model').textContent).toBe('typed|shown');
});

test('a comment after {@render} stays out of the markup', () => {
    expect(at()('rendered').textContent).toBe('start');
});

// Between braces an expression may run over several lines, as Python allows
// inside brackets: a handler, a handler with a comment, a snippet's argument
// and a binding's target.
test('a handler written over two lines runs', () => {
    const q = at();
    q('split').click();
    q('split-comment').click();
    flushSync();
    expect(q('clicks').textContent).toBe('11');
});

test('a {@render} argument written over two lines', () => {
    expect(at()('split-render').textContent).toBe('8');
});

test('a binding target written over two lines keeps its write', () => {
    const q = at();
    q('split-bound').value = 'split';
    q('split-bound').dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(q('model').textContent).toBe('start|split');
});
