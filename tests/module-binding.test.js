// A name in a `<script module>` is a **binding**, not a value.
//
// The compiler took `__jsCall(name)` once into a `const` and handed that back
// for ever, so `let amount = 1` reached Python as `1` after the JavaScript had
// moved on. And not only where reactivity was in question, which is the part
// that makes it a defect rather than a policy: a Python function that **asked
// again** still read the old number, with the call beside it proving the
// mutation had happened.
//
// Reading afresh is the repair, and it has a cost the repair has to pay: a
// function adapted twice would be two different proxies, and a registry given
// the first cannot take back the second — `off(handler)` after `on(handler)`.
// So the adaptation is memoised per function, and the last test below is what
// says so.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ModuleBinding from './fixtures/ModuleBinding.svelte';

describe('a module-scope name read from Python', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(ModuleBinding, { target });
        flushSync();

        return instance;
    };

    test('is current, not the value it had when the component was built', () => {
        const instance = setup();

        expect([...instance.read()]).toEqual([1, 1]);

        instance.step();

        // The second element is the witness: the JavaScript did move, so a
        // stale first element is the read and not the mutation.
        expect([...instance.read()]).toEqual([2, 2]);
    });

    test('and a const is still the constant it always was', () => {
        expect(setup().constant()).toBe(10);
    });

    // The identity the fresh read must not cost: the same function, read twice,
    // is one adapter.
    test('while a function read twice is the same function', () => {
        expect(setup().twice()).toBe(true);
    });
});
