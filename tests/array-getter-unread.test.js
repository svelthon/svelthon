// **Watching an array runs nothing of its author's.** A JavaScript array may
// hold an element behind a getter; the watch read every element of an array
// it took in hand, so a getter ran with nothing asking for it, and one that
// raised stopped a component that reads the length alone. Svelte's `$state`
// array, the witness, reads no element either.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { read } from './fixtures/getter_rows.js';
import GetterRows from './fixtures/GetterRows.svelte';
import GetterRowsNative from './fixtures/GetterRowsNative.svelte';

const shown = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    try {
        mount(Component, { target, props: { kind } });
        flushSync();

        return { shown: target.querySelector('output').textContent, reads: read() };
    } catch (error) {
        return { refused: String(error?.message ?? error), reads: read() };
    }
};

test.for(['counting', 'raising'])('an array whose element is a getter, %s, is watched without reading it', (kind) => {
    expect(shown(GetterRows, kind)).toEqual(shown(GetterRowsNative, kind));
    expect(shown(GetterRows, kind)).toEqual({ shown: '1', reads: 0 });
});
