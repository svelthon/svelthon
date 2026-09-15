import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import RaisingProtocol from './fixtures/RaisingProtocol.svelte';

// `{#if x}` goes through Python's `bool()` and `{x}` through its `str()`, and
// both of those are the author's code. The bridge tried Python and fell back to
// JavaScript on any exception, so a `__bool__` that raised decided the object
// was true and a `__str__` that raised rendered `[object Object]`: the error
// vanished and left a page that looked plausible.
//
// The fallback exists for a *foreign* value — a DOM node, a JavaScript object —
// which Brython's classifier trips on, and that is a different thing from the
// author's protocol failing. They are told apart by the error rather than by the
// value: a Python exception carries a class, a converter that cannot convert
// throws a JavaScript `Error`.
describe('a Python protocol that raises', () => {
    const setup = (props) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(RaisingProtocol, { target, props });
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`);
    };

    test('an object whose protocols answer is rendered by them', () => {
        const at = setup({});

        expect(at('fine').textContent).toBe('ok');
        expect(at('taken')).toBe(null);
    });

    test('and one whose protocols raise says so', () => {
        expect(() => setup({ shown: true })).toThrow(/BOOL_ERROR/);
    });
});
