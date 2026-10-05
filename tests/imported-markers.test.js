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

// The props a custom element observes are read by a second pass over the
// script, which did not know the imports: it took `start: int = inspect(41)`
// for an inspection where the compile took it for a prop.
test('an element observes a prop whose default calls an imported inspect', () => {
    expect(customElements.get('imported-inspect-element').observedAttributes).toEqual(['start']);
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
