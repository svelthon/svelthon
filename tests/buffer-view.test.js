// A memoryview shows its buffer as it is now, whichever way the buffer
// changed: written directly, through another view, or reversed in place. A
// view was watched apart from its buffer, so only a write through the view
// itself repainted it; the model read `120,98` and the page `97,98`.
//
// What the page and the model read is held against what `python3` reads, not
// against each other: a slice was a view of a copy, and both read the copy's
// `98` where CPython reads the buffer's `121`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BufferView from './fixtures/BufferView.svelte';
import BufferRelease from './fixtures/BufferRelease.svelte';

// A view released repaints what reads it, whichever way it was released: its
// buffer does not change, the view does. The model read `released` and the page
// went on showing `2` until something else it read changed.
test.for(['called', 'kept', 'through its type', 'with'])('a memoryview released, %s, repaints', (how) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BufferRelease, { target });

    flushSync();
    expect(target.querySelector('p').textContent).toBe('2');

    instance.close(how);
    flushSync();

    expect(target.querySelector('p').textContent).toBe('released');
    expect(instance.held()).toBe('released');
});

test.for([
    ['buffer', '120,98|98'],
    ['another view', '120,98|98'],
    ['reverse', '98,97|97'],
    ['the view', '120,98|98'],
    ['tail', '97,121|121']
])('a memoryview repaints when its buffer changes, through %s', ([how, cpython]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BufferView, { target });

    flushSync();
    instance.change(how);
    flushSync();

    expect(target.querySelector('p').textContent).toBe(cpython);
    expect(instance.held()).toBe(cpython);
});
