import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NamedPy from './fixtures/NamedPy.svelte';

// `py` sat in JS_RESERVED alone among the runtime's names, and for a reason that
// was real at the time: a template's expressions were compiled to JavaScript
// wrapped in `py.truthy(...)` and `py.str(...)`, so `py` was a binding in the
// component's own scope and a Python name of that spelling could not coexist
// with it.
//
// The markup has compiled to Python since — the wrappers are `__brycomp_truthy` and
// `__brycomp_text`, bound into the namespace — so the reservation outlived its cause.
describe('a module-level name spelled like a runtime helper', () => {
    test('a component may call something py', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(NamedPy, { target });
        flushSync();

        expect(target.querySelector('p[data-k="py"]').textContent).toBe('mine');
    });
});
