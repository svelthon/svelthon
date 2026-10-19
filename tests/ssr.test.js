// @vitest-environment node
//
// Server-side rendering: Svelte compiles a second version of the component that
// returns an HTML string instead of creating DOM nodes. The Python body
// therefore runs under Node — which the compiler already does at build time,
// bar two shims (`self`, `addEventListener`) laid down by Bryntime.
import { test, expect, describe } from 'vitest';
import { render } from 'svelte/server';

import Counter from '../demo/Counter.svelte';
import Greeting from '../demo/Greeting.svelte';
import Semantics from '../demo/Semantics.svelte';
import StoreDemo from '../demo/StoreDemo.svelte';
import Composition from './fixtures/Composition.svelte';
import CtxHost from './fixtures/CtxHost.svelte';
import { store } from '../demo/counter_store.svelte.py';

// Svelte sprinkles hydration markers through the HTML; only the text matters here.
const text = (result) => result.body.replace(/<!--[^>]*-->/g, '');

describe('server rendering', () => {
    // Under Node, brython.js installs `document`, `location`, `HTMLElement`,
    // `MutationObserver` and `customElements` — stubs with three keys between
    // them, for its own bootstrap. Half the ecosystem decides it is in a browser
    // with `typeof document !== "undefined"` and then reaches for `window`, which
    // nothing defines: Bits UI does exactly that, and took server rendering down
    // with a bare `ReferenceError: window is not defined`. Bryntime removes
    // them once the bootstrap is over.
    test('no browser global is left behind', () => {
        for (const name of ['document', 'window', 'location', 'HTMLElement', 'customElements']) {
            expect(typeof globalThis[name], `${name} must not exist on the server`).toBe('undefined');
        }

        // And Brython still works, which is the whole point of removing them late.
        expect(typeof globalThis.__BRYTHON__.py2js).toBe('function');
    });

    test('a Python component renders HTML with no DOM', () => {
        expect(text(render(Counter))).toBe('<button>increment()</button> <output>0</output>');
    });

    // tests/hydration.test.js starts from this exact string, markers included:
    // asserting it here forbids the two files from drifting apart in silence.
    test('the hydration markers are the ones the client expects', () => {
        expect(render(Counter).body).toBe(
            '<!--[--><button>increment()</button> <output>0</output><!--]-->'
        );
    });

    test('props are resolved on the server', () => {
        expect(text(render(Greeting, { props: { name: 'Ada' } }))).toContain('Hello Ada!');
    });

    test('Python values are computed, not approximated', () => {
        // The same canary as on the client: all three would be wrong in JS.
        const html = text(render(Semantics));

        expect(html).toContain('-4');
        expect(html).toContain('1180591620717411303424');
        expect(html).toContain('apple, pear');
    });

    test('composition and instance attributes cross over too', () => {
        const html = text(render(Composition));

        expect(html).toContain('[a:1][b:2]'); // instance attributes
        expect(html).toContain('[2][4]'); // an evaluated @property
        expect(html).toContain('<li>>a=1</li>'); // a child component
    });

    // Context, by contrast, lives in the component tree — rebuilt on every
    // render, so nothing leaks from one request to the next. It is Svelte's
    // answer to the problem below.
    test('context stays private to each render', () => {
        const first = text(render(CtxHost));
        const second = text(render(CtxHost));

        expect(first).toContain('dark/');
        expect(first).toContain('light/');
        expect(second).toBe(first);
    });

    // The server-rendering trap, and it is not Svelthon's own: a module's state
    // lives in the process, so it is shared by every request. Svelte carries
    // exactly the same warning for a module-level `$state` in a `.svelte.js`.
    // Harmless while prerendering — one pass, no concurrent users — and to be
    // avoided under per-request rendering.
    test('a store’s state persists from one render to the next', () => {
        expect(text(render(StoreDemo))).toContain('0 · []');

        store.increment();

        expect(text(render(StoreDemo))).toContain('1 · [1]');
    });
});
