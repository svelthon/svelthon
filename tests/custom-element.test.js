import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import './fixtures/Stepper.svelte';

// A component compiled as a custom element is usable from any page, with no
// Svelte around it — `<my-stepper>` in plain HTML, its script in Python.
//
// `host()` is the way back out. A custom element speaks to the page through DOM
// events rather than props, so without it a Python component could receive and
// render but never answer.
describe('a component compiled as a custom element', () => {
    test('registers itself under the name it declares', () => {
        expect(customElements.get('my-stepper')).toBeTypeOf('function');
    });

    test('and host() carries an event back to the page', async () => {
        const element = document.createElement('my-stepper');
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
    });
});
