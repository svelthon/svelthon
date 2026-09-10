import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Exposed from './fixtures/Exposed.svelte';
import ExposedHost from './fixtures/ExposedHost.svelte';

const { compile } = await import('../src/lib/compile.cjs').then((m) => m.default ?? m);

// The one thing a parent can reach on a child that is not a prop. Svelte gathers
// whatever an instance script exports into `$$exports` and hands that object
// back; `@export` is how Python says `export function`, since Python has no
// keyword for it and a decorator keeps the mark on the function itself.
describe('@export on a component function', () => {
    const script = (src) => compile(src, 'Probe', 'src/Probe.svelte').script;

    test('emits the export Svelte reads', () => {
        expect(script('@export\ndef focus():\n    pass\n')).toContain('export { focus };');
    });

    test('and only for the functions that carry it', () => {
        const out = script('@export\ndef shown():\n    pass\n\n\ndef hidden():\n    pass\n');

        expect(out).toContain('export { shown };');
        expect(out).not.toContain('hidden };');
    });

    // A component that marks nothing exposes nothing, which is Svelte's own
    // rule: an instance API is opt-in.
    test('a component with none exports nothing', () => {
        expect(script('def plain():\n    pass\n')).not.toContain('export {');
    });

    // The decorator is a marker read off the AST; at run time it is the
    // identity, so the function keeps working as a function.
    test('and the function is still callable from Python', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Exposed, { target });
        flushSync();

        expect(target.querySelector('p[data-k="count"]').textContent).toBe('0');
    });
});

describe('what bind:this then holds', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Exposed, { target });
        flushSync();
        return { instance, target };
    };

    test('carries the exported function', () => {
        expect(typeof setup().instance.bump).toBe('function');
    });

    test('which runs the Python body and answers its result', () => {
        const { instance, target } = setup();

        expect(instance.bump(3)).toBe(3);
        flushSync();
        expect(target.querySelector('p[data-k="count"]').textContent).toBe('3');
    });

    test('and an act a prop could not carry', () => {
        const { instance, target } = setup();

        instance.focus();
        expect(document.activeElement).toBe(target.querySelector('input'));
    });

    test('but not what was left undecorated', () => {
        expect(setup().instance.internal).toBeUndefined();
    });

    // The same reference read from Python, which is where an author meets it:
    // `mine.bump(2)` in a parent's own code.
    test('and Python reaches it the same way', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(ExposedHost, { target });
        flushSync();

        target.querySelector('button[data-k="go"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="said"]').textContent).toBe('2 / False');
    });
});
