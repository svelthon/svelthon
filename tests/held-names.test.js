// **A tag the compiler holds is read as Python reads its name, under a name
// the author wrote none of.** A `<svelte:element>` read for an attribute and a
// child held in a variable are read once, each into a name of the compiler's
// own, `SvelthonElement0`, `SvelthonChild1`, chosen past every name of the
// markup. Those names were compared as written, and a snippet spelled with a
// letter Python reads as `S`, `𝓢velthonElement0`, is the same name to Python:
// the held tag hid the snippet, which rendered as a string or as the child.
//
// And the child held by a name was read as JavaScript reads the name: `<Ｃard
// />` did not find the `Card` Python bound, and a name holding `None` handed
// Svelte Python's `None` to call, where Svelte takes `undefined` as no child.
// It is read as `this={Card}` is, as Python reads it.
//
// The witness is the same component in Svelte, under the names Python reads.
// The server's half is in `python-ssr.test.js`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import HeldNames from './fixtures/HeldNames.svelte';
import HeldNamesNative from './fixtures/HeldNamesNative.svelte';
import HeldNone from './fixtures/HeldNone.svelte';
import HeldNoneNative from './fixtures/HeldNoneNative.svelte';
import HeldSpelled from './fixtures/HeldSpelled.svelte';
import HeldSpelledNative from './fixtures/HeldSpelledNative.svelte';

// What each `[data-k]` of a component shows once mounted, and after `act` has
// been run on its instance.
const rendered = (Component, act = () => {}) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });

    flushSync();
    act(instance);
    flushSync();

    const seen = Object.fromEntries([...target.querySelectorAll('[data-k]')].map((one) => [one.dataset.k, one.textContent]));

    target.remove();
    return seen;
};

test('a held tag hides no snippet whose name Python reads as its own', () => {
    expect(rendered(HeldNames)).toMatchObject({ element: 'element', child: 'child' });
    expect(rendered(HeldNames)).toEqual(rendered(HeldNamesNative));
});

test('a child held by a name that holds None is no child, as undefined is to Svelte', () => {
    expect(rendered(HeldNone)).toEqual({ cleared: 'child', none: '', rows: 'child', snippet: '', declared: '' });
    expect(rendered(HeldNone, (one) => one.clear())).toEqual({ cleared: '', none: '', rows: 'child', snippet: '', declared: '' });
    expect(rendered(HeldNone, (one) => one.clear())).toEqual(rendered(HeldNoneNative, (one) => one.clear()));
});

test('a child held by a name is found under the name Python reads', () => {
    expect(rendered(HeldSpelled)).toEqual({ imported: 'child', assigned: 'child', both: 'child', javascript: 'child' });
    expect(rendered(HeldSpelled)).toEqual(rendered(HeldSpelledNative));
});
