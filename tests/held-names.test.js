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
// And the held tag stands where it is written. It was read in an `{#each}` of
// one row put around it: `animate:` asked for a key the author's block had,
// and a local transition, which plays with the block that holds it, played
// with that one, and so never. A snippet in its place set back the namespace
// of a `<svelte:element>` inside an `<svg>`, which became an HTML element, and
// a `{@const}` moved before the elements around the tag read it where a
// dynamic parent rendered nothing, and out of reach of a snippet the parent
// declares. It is read by a `{@const}` where it stands, or by one in a
// `<svelte:boundary>` around it where Svelte takes none. And its name is
// chosen past the script's names too.
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
import HeldTransitions from './fixtures/HeldTransitions.svelte';
import HeldTransitionsNative from './fixtures/HeldTransitionsNative.svelte';
import { played } from './fixtures/held_transitions.js';
import HeldNamespaces from './fixtures/HeldNamespaces.svelte';
import HeldNamespacesNative from './fixtures/HeldNamespacesNative.svelte';
import HeldScriptNames from './fixtures/HeldScriptNames.svelte';
import HeldScriptNamesNative from './fixtures/HeldScriptNamesNative.svelte';
import HeldWhere from './fixtures/HeldWhere.svelte';
import HeldWhereNative from './fixtures/HeldWhereNative.svelte';
import { reads } from './fixtures/held_reads.js';

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

// The transitions played as the block is hidden and shown again, and the rows
// once turned.
const moved = (Component) => {
    played.length = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });

    flushSync();
    instance.toggle();
    flushSync();
    instance.toggle();
    flushSync();
    instance.turn();
    flushSync();

    const rows = [...target.querySelectorAll('li')].map((one) => one.dataset.k);

    target.remove();
    return { played: [...played].sort(), rows };
};

test('a held tag plays its local transitions and takes animate:, where it is written', () => {
    const seen = moved(HeldTransitions);

    expect(seen.played).toHaveLength(20);
    expect(seen.rows.slice(0, 3)).toEqual(['named2', 'named3', 'named1']);
    expect(seen).toEqual(moved(HeldTransitionsNative));
});

// Each held element's name and namespace, once mounted, once its tag changed,
// and once its block was hidden and shown again.
const spaced = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    const seen = () =>
        Object.fromEntries([...target.querySelectorAll('[data-k]')].map((one) => [one.dataset.k, `${one.localName} ${one.namespaceURI}`]));

    flushSync();
    const steps = [seen()];
    instance.swap();
    flushSync();
    steps.push(seen());
    instance.toggle();
    flushSync();
    instance.toggle();
    flushSync();
    steps.push(seen());

    target.remove();
    return steps;
};

test('a held svelte:element takes the namespace of the element around it', () => {
    const steps = spaced(HeldNamespaces);

    expect(steps[0]).toMatchObject({ direct: 'rect http://www.w3.org/2000/svg', outer: 'rect http://www.w3.org/2000/svg' });
    expect(steps[1]).toMatchObject({ deep: 'circle http://www.w3.org/2000/svg', foreign: 'div http://www.w3.org/1999/xhtml' });
    expect(steps).toEqual(spaced(HeldNamespacesNative));
});

test("a held tag's names are none of the script's", () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(HeldScriptNames, { target });

    flushSync();
    expect([...instance.names()]).toEqual([10, 30]);
    expect(target.textContent.replace(/\s+/g, ' ').trim()).toBe('element child');
    target.remove();
    expect(rendered(HeldScriptNames)).toEqual(rendered(HeldScriptNamesNative));
});

// What the held tags read, and what is shown, while the dynamic parent renders
// nothing and once it renders a `<section>`. Svelte reads its own tags more
// than once in development, to validate them: what it shows is the witness.
const read = (Component) => {
    reads.length = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    const shown = () => [...target.querySelectorAll('[data-k]')].map((one) => `${one.dataset.k} ${one.localName} ${one.namespaceURI}`);

    flushSync();
    const before = { reads: [...reads], shown: shown() };
    instance.show('section');
    flushSync();
    const after = { reads: [...reads], shown: shown() };

    target.remove();
    return { before, after };
};

test('a held tag is read where it stands, under its parent and beside its snippets', () => {
    const seen = read(HeldWhere);

    expect(seen.before.reads).toEqual(['function', 'function']);
    expect(seen.after.reads).toEqual(['function', 'function', 'choose', 'choose']);
    const witness = read(HeldWhereNative);
    expect([seen.before.shown, seen.after.shown]).toEqual([witness.before.shown, witness.after.shown]);
});
