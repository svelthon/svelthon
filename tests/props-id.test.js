import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { mount, flushSync } from './mounted.js';
import PropsId from './fixtures/PropsId.svelte';

// `$props.id()` under the name Svelte gives it, the way `set_context` follows
// `setContext`. It is not a prop — the parent never passes it — but that is
// where a reader will find it in Svelte's own documentation.
//
// The problem it solves: a component mounted twice writes the same `id` twice,
// so `<label for=…>` points at the first field found and a screen reader
// announces the wrong label. The value is also stable between server and client,
// which a counter of ours would not be.
describe('props_id', () => {
    const mounted = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PropsId, { target });
        flushSync();

        return target.querySelector('input[data-k="input"]').id;
    };

    test('a component gets an id', () => {
        expect(mounted()).toMatch(/\S/);
    });

    test('and two instances get different ones', () => {
        expect(mounted()).not.toBe(mounted());
    });

    test('the label points at its own field', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PropsId, { target });
        flushSync();

        const label = target.querySelector('label[data-k="label"]');
        const input = target.querySelector('input[data-k="input"]');

        expect(label.getAttribute('for')).toBe(input.id);
    });

    // The rune may only be called at the top level of a component, so its value
    // cannot be produced lazily like the other injected names. The line is
    // emitted into the preamble instead — and only where the name is read.
    describe('the preamble carries it', () => {
        const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');
        const script = (src) => compile(src, 'Probe', 'probe.svelte', {}).script;

        test('when the component reads the name', () => {
            expect(script('uid = props_id()\n')).toContain('$props.id()');
        });

        test('including from inside a function', () => {
            expect(script('def f():\n    return props_id()\n')).toContain('$props.id()');
        });

        test('and not otherwise', () => {
            expect(script('count = 0\n')).not.toContain('$props.id()');
        });
    });
});
