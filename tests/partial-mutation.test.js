import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PartialMutation from './fixtures/PartialMutation.svelte';

// "An operation that raises has not changed the object" is a reasonable bet and
// a false one in Python. `xs.extend(values())` consumes what the generator
// yielded before it raised, so the list holds `[1]` and the call did not finish.
//
// The notification ran after a normal return, so the exception skipped it: the
// author caught the error, the data had changed, and the page had not. The next
// unrelated mutation revealed both at once.
//
// Found by an outside reading, which reproduced it in the DOM as well as in the
// runtime.
describe('a mutation that raises half-way', () => {
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
