// @vitest-environment node
//
// The server half of the bindings read for truth in
// `python-truth-attributes.test.js`: a server writes `checked` and `open` from
// the binding, and wrote them for an empty list. `indeterminate`, `muted` and
// `paused` Svelte leaves out of what a server renders.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import PythonTruthBindings from './fixtures/PythonTruthBindings.svelte';
import PythonTruthBindingsNative from './fixtures/PythonTruthBindingsNative.svelte';

const shown = (Component, props) => render(Component, { props }).body.replace(/<!--[^>]*-->/g, '');

test.for([['list'], ['dict'], ['tuple'], ['set'], ['object'], ['full'], ['none']])(
    'a binding read for truth renders Python’s on a server, as Svelte bound to it does: %s',
    ([kind]) => {
        const truth = kind === 'none' ? undefined : kind === 'full';

        expect(shown(PythonTruthBindings, { kind })).toBe(shown(PythonTruthBindingsNative, { truth }));
    }
);
