// @vitest-environment node
//
// The server half: what a Python component renders under Node, with no DOM.
// The template's rules hold on the server as in the browser: Python's truth on
// boolean attributes and on `class`, keys by identity, a JavaScript float read
// as a Python one. The HTML is pinned because the hydration test reads it.
import { test, expect } from 'vitest';
import v8 from 'node:v8';
import { runInNewContext } from 'node:vm';
import { render } from 'svelte/server';
import PythonTruthAttributes from './fixtures/PythonTruthAttributes.svelte';
import KeyIdentity from './fixtures/KeyIdentity.svelte';
import SvelteConstructs from './fixtures/SvelteConstructs.svelte';
import ScalarProps from './fixtures/ScalarProps.svelte';
import GroupHydrate from './fixtures/GroupHydrate.svelte';
import GroupServer from './fixtures/GroupServer.svelte';
import GroupServerNative from './fixtures/GroupServerNative.svelte';
import GroupValueShapes from './fixtures/GroupValueShapes.svelte';
import GroupValueShapesNative from './fixtures/GroupValueShapesNative.svelte';
import ServerLifecycle from './fixtures/ServerLifecycle.svelte';
import ServerLifecycleNative from './fixtures/ServerLifecycleNative.svelte';
import ServerRowsImported from './fixtures/ServerRowsImported.svelte';
import ServerRowsAssigned from './fixtures/ServerRowsAssigned.svelte';
import ServerRowsRoot from './fixtures/ServerRowsRoot.svelte';
import ServerRowsNative from './fixtures/ServerRowsNative.svelte';
import ImplicitCloseDiv from './fixtures/warned/ImplicitCloseDiv.svelte';
import ImplicitCloseDivNative from './fixtures/warned/ImplicitCloseDivNative.svelte';
import ImplicitCloseSection from './fixtures/warned/ImplicitCloseSection.svelte';
import ImplicitCloseSectionNative from './fixtures/warned/ImplicitCloseSectionNative.svelte';
import ImplicitCloseHr from './fixtures/warned/ImplicitCloseHr.svelte';
import ImplicitCloseHrNative from './fixtures/warned/ImplicitCloseHrNative.svelte';
import QueryItems from './fixtures/QueryItems.svelte';
import NormalizedNames from './fixtures/NormalizedNames.svelte';
import ContextReturned from './fixtures/ContextReturned.svelte';
import ContextReturnedNative from './fixtures/ContextReturnedNative.svelte';
import HeldNames from './fixtures/HeldNames.svelte';
import HeldNamesNative from './fixtures/HeldNamesNative.svelte';
import HeldNone from './fixtures/HeldNone.svelte';
import HeldNoneNative from './fixtures/HeldNoneNative.svelte';
import HeldSpelled from './fixtures/HeldSpelled.svelte';
import HeldSpelledNative from './fixtures/HeldSpelledNative.svelte';
import HeldTransitions from './fixtures/HeldTransitions.svelte';
import HeldTransitionsNative from './fixtures/HeldTransitionsNative.svelte';
import HeldNamespaces from './fixtures/HeldNamespaces.svelte';
import HeldNamespacesNative from './fixtures/HeldNamespacesNative.svelte';
import HeldScriptNames from './fixtures/HeldScriptNames.svelte';
import HeldScriptNamesNative from './fixtures/HeldScriptNamesNative.svelte';
import HeldWhere from './fixtures/HeldWhere.svelte';
import HeldWhereNative from './fixtures/HeldWhereNative.svelte';
import { reads } from './fixtures/held_reads.js';
import StarSnippet from './fixtures/StarSnippet.svelte';
import StarSnippetNative from './fixtures/StarSnippetNative.svelte';
import StarHooks from './fixtures/StarHooks.svelte';
import { records, reset } from './fixtures/star_records.js';
import FailedScript from './fixtures/FailedScript.svelte';
import FailedTemplate from './fixtures/FailedTemplate.svelte';
import SharedReader from './fixtures/SharedReader.svelte';
import ParentFailsAfterChild from './fixtures/ParentFailsAfterChild.svelte';
import { __pybridge, marks, track } from '../src/lib/bridge.js';
import * as html from './fixtures/python-ssr-html.js';

// `set_context` hands back what it was given on the server too, as Svelte's
// `setContext` does there: a value used as soon as it is set renders.
test('the server renders what set_context returns, as setContext returns it', () => {
    const body = render(ContextReturned).body;

    expect(body).toContain('<p data-k="same">1 1 1 1</p>');
    expect(body).toBe(render(ContextReturnedNative).body);
});

// A tag the compiler holds on the server too (`held-names.test.js`), compared
// past the hydration markers, which the block holding the tag adds.
const shown = (Component) => render(Component).body.replace(/<!--[^>]*-->/g, '');

// It hides no snippet whose name Python reads as its own.
test('the server renders a snippet named as Python reads a held tag, as Svelte does', () => {
    const body = shown(HeldNames);

    expect(body).toContain('<output data-k="element">element</output>');
    expect(body).toContain('<output data-k="child">child</output>');
    expect(body).toBe(shown(HeldNamesNative));
});

// A name that holds `None` holds no child, and a name is found as Python reads
// it.
test('the server renders a child held by a name as Python reads the name, None as no child', () => {
    expect(shown(HeldNone)).toBe(shown(HeldNoneNative));
    expect(shown(HeldSpelled)).toBe(shown(HeldSpelledNative));
    expect(shown(HeldSpelled).match(/<output>child<\/output>/g)).toHaveLength(4);
});

// And a held tag stands where it is written, `animate:` alone in its keyed
// block.
test('the server renders a held tag in every place it stands, as Svelte does', () => {
    expect(shown(HeldTransitions)).toContain('<li data-k="quoted1">1</li>');
    expect(shown(HeldTransitions)).toBe(shown(HeldTransitionsNative));
});

// Inside an `<svg>` and beside the script's names too.
test('the server renders a held tag inside an svg and beside the names of the script, as Svelte does', () => {
    expect(shown(HeldNamespaces)).toContain('<rect data-k="direct" width="20"></rect>');
    expect(shown(HeldNamespaces)).toBe(shown(HeldNamespacesNative));
    expect(shown(HeldScriptNames)).toBe(shown(HeldScriptNamesNative));
});

// And it is read where it stands: not at all under a parent that renders
// nothing.
test('the server reads a held tag where it stands, as Svelte does', () => {
    reads.length = 0;
    const body = shown(HeldWhere);

    expect(reads).toEqual(['function', 'function']);
    expect(body).toBe(shown(HeldWhereNative));
});

// A snippet brought by `*` renders under its bare name on the server too
// (`snippet-names.test.js`).
test('the server renders a snippet brought by * under its bare name, as Svelte does', () => {
    expect(shown(StarSnippet)).toContain('named');
    expect(shown(StarSnippet)).toBe(shown(StarSnippetNative));
});

test.for([
    ['Python truth on attributes and class', PythonTruthAttributes, {}, 'PythonTruthAttributes'],
    ['keys by identity and by repr', KeyIdentity, {}, 'KeyIdentity'],
    ['the everyday constructs of Svelte 5', SvelteConstructs, {}, 'SvelteConstructs'],
    ['props given as JavaScript floats', ScalarProps, { amount: 0.42, two_way: 0.42 }, 'ScalarProps'],
    ['two empty groups', GroupHydrate, {}, 'GroupHydrate']
])('the server renders %s', ([, Component, props, name]) => {
    expect(render(Component, { props }).body).toBe(html[name]);
});

// A group whose model holds a selection is checked by the server, as Svelte's
// server checks its own: the page shows it, and a form sent before the script
// runs sends it.
test('the server checks what a group holds, as Svelte does', () => {
    const checked = (Component, props = {}) =>
        [...render(Component, { props }).body.matchAll(/<input data-k="([^"]+)"[^>]*>/g)]
            .filter((one) => /\schecked(?:[\s=/>]|$)/.test(one[0]))
            .map((one) => one[1]);

    const native = checked(GroupServerNative);

    expect(native).toEqual(['b', 'y', 'half']);
    expect(checked(GroupServer)).toEqual(native);

    // And the value written as the shorthand, `{value}`, which the server
    // was handed no value for and left unchecked.
    const shapes = (Component) => checked(Component, { next_value: () => 1 });

    expect(shapes(GroupValueShapesNative)).toEqual(['long', 'short']);
    expect(shapes(GroupValueShapes)).toEqual(shapes(GroupValueShapesNative));
});

// A script after a `<p>` Svelte closes at the next tag is the component's on the
// server as well, and its markup Python: the render failed with `name.upper is
// not a function`.
test.for([
    ['div', ImplicitCloseDiv, ImplicitCloseDivNative],
    ['section', ImplicitCloseSection, ImplicitCloseSectionNative],
    ['hr', ImplicitCloseHr, ImplicitCloseHrNative]
])('the server renders a script after a <p> closed by <%s> as the component’s', ([, Python, Native]) => {
    const output = (Component) => render(Component).body.match(/<output>(.*?)<\/output>/)[1];

    expect(output(Python)).toBe(output(Native));
    expect(output(Python)).toBe('ADA');
});

// A name the markup declares, read under another spelling Python takes for the
// same name, renders on the server too: the render raised `NameError`.
test('the server reads a declared name under another spelling', () => {
    const body = render(NormalizedNames).body;
    const text = (k) => body.match(new RegExp(`data-k="${k}">(.*?)</p>`))[1];

    expect(['each', 'each back', 'snippet', 'declared'].map(text)).toEqual(['OK', 'OK', 'OK', 'OK']);
});

// And a dict's `items()` is what the server encodes, as CPython reads it.
test('the server encodes a dict through its items()', () => {
    const body = render(QueryItems).body;
    const text = (k) => body.match(new RegExp(`data-k="${k}">(.*?)</p>`))[1];

    expect(text('query')).toBe('tag=selected');
    expect(text('refused')).toBe('raises: query items failed');
    expect(text('copied')).toBe('selected');
});

// `on_destroy` runs when the server's render closes, as Svelte's `onDestroy`
// does, and what it raises fails the render; `on_mount` never runs there. The
// hook defined, bound by `=`, raising, or never bound.
test.for(['functions', 'destroy_only', 'assigned', 'raising', 'disabled'])(
    'on_destroy runs when the server render closes: %s',
    (mode) => {
        const run = (Component) => {
            const calls = [];
            let failed = false;

            // The render happens when its body is read.
            try {
                void render(Component, { props: { mode, enabled: mode !== 'disabled', notify: (one) => calls.push(one) } }).body;
            } catch (error) {
                failed = String(error.message ?? error).includes('destroy failed');
            }

            return { calls, failed };
        };
        const native = run(ServerLifecycleNative);

        expect(native.calls).toEqual(mode === 'disabled' ? ['init'] : ['init', 'destroy']);
        expect(run(ServerLifecycle)).toEqual(native);
    }
);

// And brought by `from m import *`, which binds names no statement lists.
test('on_destroy runs when the server render closes: brought by a star import', () => {
    reset();

    void render(StarHooks).body;

    expect(records).toEqual(['destroy']);
});

// A server render that fails keeps no subscription of a component to a shared
// list it read: the server calls `onDestroy` when a render closes, and a render
// that raises, in the component or in a parent rendered after it, never closes.
// Each failed render kept one more.
test.for([
    ['in its script', FailedScript, {}],
    ['in its template', FailedTemplate, {}],
    ['in a parent, after it', ParentFailsAfterChild, { Child: SharedReader }]
])('a server render that fails %s keeps no subscription to a shared list', ([, Component, props]) => {
    const list = __pybridge.list([1]);
    const counts = [];

    track(list, () => {});
    for (let i = 0; i < 3; i++) {
        expect(() => render(Component, { props: { ...props, shared: list } }).body).toThrow();
        counts.push(marks(list).bumps.length);
    }

    expect(counts).toEqual([1, 1, 1]);
});

// And on a server with a `document` on its global, a DOM laid down for a
// library or a test run under jsdom, a render that succeeds and one that
// fails: told from a browser by the `document` it lacks, a server with one
// closed nothing, and each render kept one more.
test.for([
    ['succeeds', SharedReader, {}],
    ['fails', ParentFailsAfterChild, { Child: SharedReader }]
])('a server render that %s with a document on the global keeps no subscription', ([outcome, Component, props]) => {
    const list = __pybridge.list([1]);
    const counts = [];

    track(list, () => {});
    globalThis.document = {};
    try {
        for (let i = 0; i < 3; i++) {
            const body = () => render(Component, { props: { ...props, shared: list } }).body;

            if (outcome === 'fails') expect(body).toThrow();
            else expect(body()).toContain('1');
            counts.push(marks(list).bumps.length);
        }
    } finally {
        delete globalThis.document;
    }

    expect(counts).toEqual([1, 1, 1]);
});

// A component that reads a module's list, imported, assigned to a name, or
// with a root effect beside it, is let go once its server render closes, as
// Svelte's own is. The subscription its names make on the list was dropped by
// an effect, which the server never runs: each of 200 renders stayed alive.
test('a server render reading a module list is let go when it closes', async () => {
    v8.setFlagsFromString('--expose-gc');
    const gc = runInNewContext('gc');
    const alive = async (Component) => {
        const refs = [];

        for (let i = 0; i < 200; i++) {
            const token = { i };

            void render(Component, { props: { token } }).body;
            refs.push(new WeakRef(token));
        }
        for (let round = 0; round < 10; round++) {
            await new Promise((resolve) => setTimeout(resolve, 10));
            gc();
        }

        return refs.filter((ref) => ref.deref() !== undefined).length;
    };

    expect(await alive(ServerRowsNative)).toBeLessThan(10);
    expect(await alive(ServerRowsImported)).toBeLessThan(10);
    expect(await alive(ServerRowsAssigned)).toBeLessThan(10);
    expect(await alive(ServerRowsRoot)).toBeLessThan(10);
});
