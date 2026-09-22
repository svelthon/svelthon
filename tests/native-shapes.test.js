// @vitest-environment node
//
// **Where a value sits must not decide what it becomes.**
//
// A JavaScript instance carrying a callback as a field — `this.callback = () =>
// …`, which is an ordinary shape — was rebuilt as an object literal by the
// export branch and lost its prototype: `service.ping` was `undefined` for the
// consumer, while the *same* object returned by a function came back whole. The
// branch asked `does any entry hold a function`, which is true of a mapping of
// callbacks and true of an instance that happens to have one.
//
// `plainData` has had the rule as long as it has had the sentence above it —
// *anything of a class of its own is not ours to flatten* — and the export
// branch, the second site that writes a mapping out, did not ask it.
//
// So the rows are the three routes a value takes out of a module, and the
// invariants are the three an object has: **the value, the identity, and the
// prototype**. A test that only calls a method would have passed throughout.
import { test, expect, describe } from 'vitest';

import * as module from './fixtures/native_shapes.py';
import { service, plain, Service, actions } from './fixtures/native_shapes.js';

describe('a native object leaving a Python module', () => {
    test.for([
        ['published as a value', () => module.direct],
        ['given back by a function', () => module.returned()],
        ['inside a list', () => module.held()[0]],
        ['under a key', () => module.keyed().one]
    ])('%s keeps what it is', ([, reach]) => {
        const out = reach();

        expect(out).toBe(service);
        expect(Object.getPrototypeOf(out)).toBe(Service.prototype);
        expect(typeof out.ping).toBe('function');
        expect(out.ping()).toBe('ok');
    });

    // The witness beside it: an instance with no own callback took the other
    // path all along, so the field is what changed the contract of the whole
    // object rather than anything about the class.
    test('and one with no callback of its own is unchanged too', () => {
        expect(module.plain_direct).toBe(plain);
        expect(module.plain_direct.ping()).toBe('ok');
    });

    // And the shape the branch exists for, which must keep working: a mapping
    // of functions is what SvelteKit's `actions` is, and its entries are
    // adapted rather than handed over raw.
    test('while a mapping of functions is still adapted', () => {
        expect(module.actions_direct).not.toBe(actions);
        expect(module.actions_direct.save()).toBe('saved');
    });
});
