// **A Python child a JavaScript object kept is still a Python child.** Read
// back off the object, it was the engine's wrapper of a method, which no
// Python component announces, so it was handed JavaScript's numbers, and the
// `Price` reached it a plain float without its `currency`. The child imported
// as it is is the witness, `Price|EUR`, as CPython's `type(value).__name__`
// says; a method read off a JavaScript object still runs on it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import HeldProvenance from './fixtures/HeldProvenance.svelte';

test.for([['box'], ['getter'], ['nested'], ['namespace'], ['returned'], ['direct']])(
    'a Python child read back %s from JavaScript keeps the Price it is handed',
    ([mode]) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(HeldProvenance, { target, props: { mode } });
        flushSync();

        expect(target.textContent.trim()).toBe('Price|EUR');
        expect(instance.method()).toBe('kept:number:0.50');
    }
);
