// **The expressions a destructuring holds: where they are compiled, and what
// they read.**
//
// A pattern holds two of them — a default, and a computed key — and both are
// Python like everything else a template holds.
//
// **A default reads the names beside it.**
//
// Compiling one is half the job; compiling it *in the right scope* is the other
// half, and the first version had only the outer namespace to offer: the
// expressions were compiled before the declaration opened its scope, so
// `{#each rows as [first, second=first]}` gave `second` a module's `first`
// instead of the row's. The component mounted, the shape was right, and the
// value was someone else's.
//
// Measured on Svelte, which is where the rule comes from, since a snippet's
// parameter list and an `{#each}` target are compiled to JavaScript ones:
//
//   `[a, b = a]`     a default reads a name bound earlier in the same pattern
//   `[c = first]`    an outer name that nothing masks is still read
//   `[first, …]`     a name the pattern binds masks the module's
//   `[f = i], i`     the loop index is in scope for a default too
//   `[[m, n = m]]`   all of it again, one level down
//   `(j, k = j)`     and the same in a snippet's parameter list
//   `[g = h, h]`     while reaching *forward* throws, as JavaScript throws
//
// The last row is why every name goes into the scope before any expression is
// compiled, rather than each name as its turn comes: our output reads the
// binding Svelte emitted, so the temporal dead zone is inherited rather than
// re-implemented.
import { test, expect, describe } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import PatternScope from './fixtures/PatternScope.svelte';
import PatternScopeNative from './fixtures/PatternScopeNative.svelte';
import PatternScopeAhead from './fixtures/PatternScopeAhead.svelte';
import PatternScopeAheadNative from './fixtures/PatternScopeAheadNative.svelte';

const rendered = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    return Object.fromEntries(
        [...target.querySelectorAll('i')].map((one) => [one.dataset.k, one.textContent])
    );
};

// The same reading once every `{#await}` has settled.
const awaited = async (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });

    const read = () =>
        Object.fromEntries(
            [...target.querySelectorAll('i[data-k^="await"]')].map((one) => [one.dataset.k, one.textContent])
        );

    await settled(() => expect(Object.keys(read())).toHaveLength(3));

    return read();
};

const raised = (Component) => {
    try {
        rendered(Component);
    } catch (error) {
        return String(error.message);
    }

    return null;
};

describe('what a destructuring default may read', () => {
    test('is what Svelte lets one read, on the same declarations', () => {
        expect(rendered(PatternScope)).toEqual(rendered(PatternScopeNative));
    });

    // The witness the comparison cannot give: that both are the right answer
    // rather than the same wrong one. `earlier` and `shadow` are the rows the
    // defect showed in — each answered `99`, the module's value, where the
    // pattern had just bound `1`.
    test('and the answers are the ones the declaration was written for', () => {
        expect(rendered(PatternScope)).toEqual({
            earlier: '1:1',
            outer: '99',
            shadow: '1:1',
            index: '7:0',
            'reads-index': '0:0',
            nested: '1:1',
            snippet: '1:1',
            unpacked: '1:1',
            'snippet-unpacked': '1:1',
            'snippet-starred': '1:2',
            key: '42',
            'snippet-key': '7',
            literal: 'total:0'
        });
    });

    // **A default reading a name a row before it unpacks**, by key or around a
    // star: those names are bound by `{@const}` after the pattern, and the
    // default was taken with the pattern, before, so the component did not mount
    // (`Cannot access 'first' before initialization`). The server half is in
    // `pattern-scope-ssr.test.js`.
    test('a default may read a name a row before it unpacks', () => {
        expect(rendered(PatternScope)).toMatchObject({
            unpacked: '1:1',
            'snippet-unpacked': '1:1',
            'snippet-starred': '1:2'
        });
    });

    // **The other place a pattern holds an expression**, and the one the walk
    // copied across as written: a computed key. `{[field.upper()]: value}`
    // reached the browser as a JavaScript method call — *get(...).upper is not
    // a function* — while the target beside it was compiled. Its names are read
    // and never bound, so `field` is still the module's.
    test.for([
        ['an {#each} target', 'key', '42'],
        ['and a snippet parameter', 'snippet-key', '7']
    ])('a computed key is Python, in %s', ([, at, answer]) => {
        expect(rendered(PatternScope)[at]).toBe(answer);
    });

    // **A word inside a string is text, not a reference.** The names handed to
    // `follow` were read off the expression's raw text, so a default that is a
    // plain string spelling a sibling's name subscribed to that sibling — and
    // the subscription is prepared before the sibling exists, so the component
    // could not mount at all. The string is `"total"` and the name is `total`.
    test('a default that is a string naming a later binding still mounts', () => {
        expect(rendered(PatternScope).literal).toBe('total:0');
    });

    // What an `{#await}` hands to `then` or `catch` is a declaration like the
    // others, in the opening tag and as a clause alike. `len` is Python's and
    // nothing else's, so a default that stayed JavaScript cannot answer.
    test('what an {#await} hands over is declared the same way', async () => {
        const ours = await awaited(PatternScope);

        expect(ours).toEqual(await awaited(PatternScopeNative));
        expect(ours).toEqual({ 'await-short': '2', 'await-then': '2', 'await-catch': '2' });
    });

    // And the other direction, which declaring every name first is what makes
    // possible: a default reaching a name that comes *after* it is an error in
    // JavaScript, and it has to stay one rather than quietly find a module's.
    test('while reaching forward raises, as it does in Svelte', () => {
        expect(raised(PatternScopeAhead)).toMatch(/before initialization/);
        expect(raised(PatternScopeAheadNative)).toMatch(/before initialization/);
    });
});
