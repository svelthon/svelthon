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
