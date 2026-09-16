// A mutation that raises has still mutated.
//
// "An operation that raises has not changed the object" is a reasonable bet and
// a false one in Python. `xs.extend(values())` consumes what the generator
// yielded before it raised, so the list holds `[1]` and the call did not finish.
// The method paths learned that first: they notify in a `finally`.
//
// The operator path did not. The interception of `+=`, `|=` and the rest called
// the operator, then notified if it had handed back the same object. An
// exception skips the second half:
// `d |= values()` keeps the entries the generator yielded before it failed, the
// operator never returns, the assignment that would have rebound the name never
// happens, and nothing downstream makes up for the missing notification. The
// data moved and the page did not.
//
// The method paths already had the shape — they notify in a `finally` — which is
// what makes the two fixtures here a controlled comparison: `target.update(...)`
// and `target |= ...`, same generator, same caught error, one line apart.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PartialMutation from './fixtures/PartialMutation.svelte';
import PartialAugment from './fixtures/PartialAugment.svelte';
import PartialUpdate from './fixtures/PartialUpdate.svelte';

const setup = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    return {
        read: (key) => target.querySelector(`[data-k="${key}"]`)?.textContent,
        press: (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        }
    };
};

// The first half of this file, and the one that was already closed: a method
// call, found by an outside reading which reproduced it in the DOM as well as in
// the runtime.
describe('a method that raises half-way', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PartialMutation, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('shows what the list actually holds', () => {
        const { read, click } = setup();

        expect(read('xs')).toBe('[]');
        click('go');

        expect(read('xs')).toBe('[1]');
    });

    // The other path into the mechanism: the method taken off the object as a
    // value, where the wrapper rather than the interception carries the rule.
    test('and so does a detached mutator', () => {
        const { read, click } = setup();

        click('go_detached');

        expect(read('detached')).toBe('[1]');
    });

    // The exception is the author's to handle, and notifying must not swallow
    // it: the component is still alive and rendering after catching one.
    test('the exception still reaches the author, who caught it', () => {
        const { read, click } = setup();

        click('go');
        click('go');

        expect(read('xs')).toBe('[1, 1]');
    });
});

describe.for([
    ['an augmented assignment', PartialAugment],
    ['a method call', PartialUpdate]
])('%s that raises after inserting', ([, Component]) => {
    test('repaints what it did insert', () => {
        const { read, press } = setup(Component);

        expect(read('total')).toBe('0');

        press('partial');

        expect(read('total')).toBe('1');
    });
});

describe('the neighbouring shapes of the same operator', () => {
    // An operator that raises before inserting anything leaves nothing to show,
    // and the page has to stay where it was rather than be repainted wrong.
    test('an error before any insertion changes nothing', () => {
        const { read, press } = setup(PartialAugment);

        press('early');

        expect(read('total')).toBe('0');
    });

    test('and an operation that succeeds repaints as it always did', () => {
        const { read, press } = setup(PartialAugment);

        press('whole');

        expect(read('total')).toBe('1');
    });

    // The half that notification alone does not buy: a container inserted
    // before the failure has to come under watch too, or mutating it later
    // repaints nothing.
    // And the key side of the same question, which a subscript cannot answer
    // for: reading a key is not one of the ways the watch is handed over, so a
    // key inserted by the failed operator has to have been adopted there.
    test('a key inserted before the failure is watched', () => {
        const { read, press } = setup(PartialAugment);

        press('boxed');

        expect(read('scored')).toBe('0');

        press('bump-keys');

        expect(read('scored')).toBe('1');
    });

    test('a container inserted before the failure is watched', () => {
        const { read, press } = setup(PartialAugment);

        press('deep');

        expect(read('total')).toBe('1');
        expect(read('inner')).toBe('1');
    });
});
