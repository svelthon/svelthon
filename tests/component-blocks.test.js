// A component's scripts and styles are found where Svelte's parser finds them,
// and the markup around them is read in one piece.
//
// A `<style>` written in a Python string was taken for the component's: the
// expression was cut in two and Svelte refused the half it was handed,
// `Expected token }`. And a real `<style>` inside an `{#each}` cut the markup
// in two, the second half read with a fresh scope: `NameError: name 'row' is
// not defined`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import QuotedBlocks from './fixtures/QuotedBlocks.svelte';
import BlocksInLoops from './fixtures/BlocksInLoops.svelte';
import BlocksInLoopsNative from './fixtures/BlocksInLoopsNative.svelte';

const mounted = (component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(component, { target });
    flushSync();

    return target;
};

// What `python3` gives for each expression, and what Svelte makes of the
// attribute's text around `{name}`.
test.for([
    ['f-string style', '<style>Ada</style>'],
    ['f-string script', '<script>Ada</script>'],
    ['language', '<script lang=python>Ada</script>'],
    ['comment', 'ADA']
])('a tag quoted in %s is text', ([where, cpython]) => {
    expect(mounted(QuotedBlocks).querySelector(`[data-k="${where}"]`).textContent).toBe(cpython);
});

test('a tag quoted in an attribute is text', () => {
    expect(mounted(QuotedBlocks).querySelector('[data-k="attribute"]').title).toBe('> <style>ADA</style>');
});

// A textarea's content is text and expressions, as Svelte's parser reads it.
test('a tag written in a textarea is text', () => {
    expect(mounted(QuotedBlocks).querySelector('[data-k="textarea"]').value).toBe('<style>ADA</style>');
});

// Held against the same markup with JavaScript expressions, which Svelte
// compiles as written.
test.for(['each', 'nested', 'script'])('a block inside a loop keeps its names, %s', (where) => {
    const read = (target) => target.querySelector(`[data-k="${where}"]`).textContent;

    expect(read(mounted(BlocksInLoops))).toBe(read(mounted(BlocksInLoopsNative)));
    expect(read(mounted(BlocksInLoops))).toBe('Ada:0');
});

test('a style inside a loop is an element, its attributes markup', () => {
    const read = (target) => target.querySelector('style[data-row]').dataset.row;

    expect(read(mounted(BlocksInLoops))).toBe(read(mounted(BlocksInLoopsNative)));
    expect(read(mounted(BlocksInLoops))).toBe('ADA');
});
