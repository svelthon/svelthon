import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { marks, track } from './../src/lib/runtime.js';
import NotifyKey from './fixtures/NotifyKey.svelte';

// The marker of a watched container used to be a non-enumerable `$notify`
// property on the container itself, and **a Brython dict exposes its keys as
// ordinary properties**. So a business key of that spelling met the mechanism:
// the component failed at mount, on data Python is entitled to hold.
//
// It is held in a WeakMap now. Not a symbol: an own symbol key makes an object
// unusable as a WebIDL record, which is what `new Response(body, {headers})`
// takes, and Brython hit that same wall with its own back-reference.
//
// Found by an outside reading. The repair is what the whole file is about: a
// mark that belongs to the runtime does not live in the author's data.
describe('a container whose data collides with the marker', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(NotifyKey, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`[data-k="${k}"]`).textContent,
            node: (k) => target.querySelector(`[data-k="${k}"]`)
        };
    };

    test('mounts, where it used to fail outright', () => {
        expect(setup().read('n')).toBe('1');
    });

    test('and the business value is the one Python wrote', () => {
        expect(setup().read('business')).toBe('business data');
    });

    // The key survives as a key, rather than being swallowed by the mechanism or
    // hidden from `keys()`.
    test('the key is still a key of the dict', () => {
        expect(setup().read('keys')).toBe("['$notify', 'n']");
    });

    // And the container is still watched, which is the half a guard on the type
    // of `$notify` would have bought at the price of the reactivity.
    test('mutating another field still re-renders', () => {
        const { read, node } = setup();

        node('bump').click();
        flushSync();

        expect(read('n')).toBe('2');
        expect(read('business')).toBe('business data');
    });

    // The marker is reachable by name from the runtime and by no other route:
    // nothing an author writes can collide with it, and nothing that walks the
    // container can see it.
    test('the marker is outside the value, not a property of it', () => {
        const rows = [];

        track(rows, () => {}, () => {}, []);

        expect(typeof marks(rows)).toBe('function');
        expect(Object.keys(rows)).toHaveLength(0);
        expect(Object.getOwnPropertyNames(rows)).not.toContain('$notify');
    });
});
