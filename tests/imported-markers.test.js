// A function imported from JavaScript under a marker's name, `inspect` or
// `derived`, is the author's. At the top level `answer = inspect(41)` was read as
// an inspection: the line emitted `$inspect(…)`, which Svelte read as the store
// `inspect`, and the component did not mount. Against the same component written
// in JavaScript.
import { test, expect, beforeEach } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import ImportedMarkers from './fixtures/ImportedMarkers.svelte';
import ImportedMarkersNative from './fixtures/ImportedMarkersNative.svelte';
import { seen } from './fixtures/imported_markers.js';
import './fixtures/ImportedInspectElement.svelte';
import ImportedDecorators from './fixtures/ImportedDecorators.svelte';

// And used as decorators, `@derived` and `@effect` over a `def`: the library's
// decorators, which hand the function back. They were read as the markers, and
// the component emitted `$derived.by` and `$effect` beside the imports, which
// Svelte read as stores, and did not mount.
test('a decorator imported under a marker name is the library s', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ImportedDecorators, { target });
    flushSync();

    expect(['answer', 'ran'].map((k) => target.querySelector(`p[data-k="${k}"]`).textContent)).toEqual(['42', '0']);
});

// The props a custom element observes are read by a second pass over the
// script, which did not know the imports: it took `start: int = inspect(41)`
// for an inspection where the compile took it for a prop.
test('an element reads a prop whose default calls an imported inspect as the type it declares', async () => {
    const element = document.createElement('imported-inspect-element');
    element.setAttribute('start', '5');
    document.body.appendChild(element);
    await Promise.resolve();
    flushSync();

    try {
        expect(typeof element.start).toBe('number');
    } finally {
        element.remove();
    }
});

beforeEach(() => {
    seen.length = 0;
});

test.for([
    ['Python', ImportedMarkers],
    ['JavaScript', ImportedMarkersNative]
])('in %s, each call is a call and its value is data', async ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });

    try {
        flushSync();

        expect(target.textContent.trim()).toBe('42:2');
        expect(seen).toEqual([41, 1]);
    } finally {
        await unmount(instance);
        target.remove();
    }
});
