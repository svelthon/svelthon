import { test, expect, describe, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { mount, flushSync } from './mounted.js';
import './fixtures/Stepper.svelte';
import WordHost from './fixtures/WordHost.svelte';

// A component compiled as a custom element is usable from any page, with no
// Svelte around it — `<my-stepper>` in plain HTML, its script in Python.
//
// `host()` is the way back out. A custom element speaks to the page through DOM
// events rather than props, so without it a Python component could receive and
// render but never answer.
describe('a component compiled as a custom element', () => {
    // The element has to leave with the test that made it. A custom element
    // disconnected by the *document* going away reaches Svelte's `unmount`
    // after jsdom has taken `document` down, and the teardown throws
    // `ReferenceError: document is not defined` into an unhandled rejection.
    //
    // Measured over five full runs before this existed: three ended that way,
    // and the file alone never did. It is a race with the worker shutting down,
    // so it was intermittent, and vitest says in as many words that an unhandled
    // error "might cause false positive tests".
    const mounted = [];

    afterEach(() => {
        while (mounted.length) mounted.pop().remove();
    });

    test('registers itself under the name it declares', () => {
        expect(customElements.get('my-stepper')).toBeTypeOf('function');
    });

    test('and host() carries an event back to the page', async () => {
        const element = document.createElement('my-stepper');
        mounted.push(element);
        document.body.appendChild(element);
        await Promise.resolve();

        const seen = [];
        element.addEventListener('stepped', (event) => seen.push(event.type));

        element.shadowRoot.querySelector('button[data-k="bump"]').click();
        await Promise.resolve();

        expect(seen).toEqual(['stepped']);
    });

    // Svelte refuses `$host()` at compile time outside a custom element, so the
    // binding is emitted only where the name is read.
    describe('the binding is conditional', () => {
        const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');
        const script = (src) => compile(src, 'Probe', 'probe.svelte', {}).script;

        test('present when the component reads it', () => {
            expect(script('def go():\n    return host()\n')).toContain("bind(__proto, 'host'");
        });

        test('absent otherwise', () => {
            expect(script('count = 0\n')).not.toContain("bind(__proto, 'host'");
        });

        // And absent when the author only wrote the *word*. The test used to be
        // a text search over the generated JavaScript, where Brython emits a
        // Python string literal as a JavaScript one: `role = "host"` became
        // `locals.role = 'host'` and the search matched its own quotation marks.
        // The component then emitted `$host()`, which Svelte refuses outside a
        // custom element, so a component holding that word in a string did not
        // render at all. A `Name` node is the question; a string is not.
        test.for([
            ['a string', 'role = "host"\n'],
            ['inside a list', 'roles = ["host", "guest"]\n'],
            ['as a dict key', 'd = {"host": 1}\n'],
            ['in a comparison', 'role = "guest"\nis_host = role == "host"\n'],
            ['in an f-string', 'n = 1\nlabel = f"{n}host"\n'],
            ['and the same for props_id', 'tag = "props_id"\n']
        ])('%s does not emit the binding', ([, src]) => {
            const out = script(src);

            expect(out).not.toContain("bind(__proto, 'host'");
            expect(out).not.toContain("bind(__proto, 'props_id'");
        });

        // And the whole way: a component holding the word in four ordinary
        // places renders. Compiled, it did not — Svelte answered that `$host()`
        // can only be used inside custom element component instances, about a
        // call the author never wrote.
        test('a component that only writes the word renders', () => {
            const target = document.body.appendChild(document.createElement('div'));

            mount(WordHost, { target });
            flushSync();

            const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

            expect(read('role')).toBe('host');
            expect(read('roles')).toBe("['host', 'guest']");
            expect(read('rooms')).toBe('1');
            expect(read('label')).toBe('host of the room');
        });
    });
});
