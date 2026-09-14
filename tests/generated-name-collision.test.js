import { createRequire } from 'node:module';

import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NameV from './fixtures/NameV.svelte';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

// A third category of name, which the project had not named.
//
// `JS_RESERVED` refuses what JavaScript will not take as a binding; the locked
// words refuse Svelthon's own vocabulary. Neither covers **a name the generated
// code uses for itself**, which an author may legitimately want. The setter's
// parameter was `v`, so a module-level `v` was shadowed by it: the assignment
// wrote the parameter, the `let v` was never touched, and the name was
// `<Javascript undefined>` for the life of the component, silently.
//
// Found by an outside reading, and by accident: one snippet of its CPython
// oracle used `v` for a value.
describe('a module-level name the generated code also uses', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(NameV, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`[data-k="${k}"]`).textContent,
            node: (k) => target.querySelector(`[data-k="${k}"]`)
        };
    };

    test('`v` is the value it was given, like the same expression under another name', () => {
        const { read } = setup();

        expect(read('v_type')).toBe('float');
        expect(read('v_type')).toBe(read('n_type'));
        expect(read('v')).not.toContain('undefined');
    });

    test('and a handler can still write to the component', () => {
        const { read, node } = setup();

        node('bump').click();
        flushSync();

        expect(read('count')).toBe('1');
    });

    // The collision was only ever with a name at module level, which is the one
    // kind that gets a binding. The same letter inside a `def` was correct all
    // along, and this is what says so.
    test('`v` inside a def is an ordinary local', () => {
        expect(setup().read('loop')).toBe('a1');
    });

    // The invariant behind the repair, held rather than described: the setter's
    // parameter must never be the name it assigns to. A future rename into a
    // collision turns this red without anyone having to think of the letter.
    test('no emitted setter takes a parameter named after what it writes', () => {
        const names = ['v', 'n', 'value', 'one', 'f', 'fn', 'key', 'x', 'a', 'init', 'args', 'err'];

        for (const name of names) {
            const { script } = compile(`${name} = 1\n`, 'Probe', 'src/Probe.svelte');

            for (const [, parameter, written] of script.matchAll(
                /\((\w+)\) => \{ (\w+) = /g
            )) {
                expect(parameter).not.toBe(written);
            }
        }
    });
});
