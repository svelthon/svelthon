// **A tag the compiler holds takes a name the author wrote none of, as Python
// reads the author's.** A `<svelte:element>` read for an attribute and a child
// held in a variable are read once, each into a name of the compiler's own,
// `SvelthonElement0`, `SvelthonChild1`, chosen past every name of the markup.
// Those names were compared as written, and a snippet spelled with a letter
// Python reads as `S`, `𝓢velthonElement0`, is the same name to Python: the
// held tag hid the snippet, which rendered as a string or as the child. The
// witness is the same component in Svelte, under the names Python reads. The
// server's half is in `python-ssr.test.js`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import HeldNames from './fixtures/HeldNames.svelte';
import HeldNamesNative from './fixtures/HeldNamesNative.svelte';

const rendered = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`)?.textContent;
    const seen = { element: read('element'), child: read('child') };

    target.remove();
    return seen;
};

test('a held tag hides no snippet whose name Python reads as its own', () => {
    expect(rendered(HeldNames)).toEqual({ element: 'element', child: 'child' });
    expect(rendered(HeldNames)).toEqual(rendered(HeldNamesNative));
});
