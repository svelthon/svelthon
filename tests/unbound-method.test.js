import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import UnboundMethod from './fixtures/UnboundMethod.svelte';

// `xs.append(1)` and `list.append(xs, 2)` are the same mutation, and only the
// first was reactive. The watch reads the object a method was called *on*, and
// in the second spelling the attribute is read on the type: the list is an
// argument. The data grew and the page kept the old value, until some other
// mutation of `xs` revealed both at once.
//
// The earlier repair for `add = xs.append; add(2)` does not reach this one: it
// wraps a method as it leaves *its object*, and this method never belonged to
// one.
describe('a mutation written through the type', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(UnboundMethod, { target });
        flushSync();

        return {
            read: () => target.querySelector('p[data-k="xs"]').textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('shows on the page like the ordinary one', () => {
        const { read, click } = setup();

        expect(read()).toBe('[]');
        click('type');
        expect(read()).toBe('[2]');
    });

    // The neighbour this file used to call uncoverable: `add = list.append`
    // hands back a **method descriptor**, an object and not a function, and the
    // wrapper the bound path uses does not fit it — wrapping it in one anyway
    // turned the two tests above red, since the call interception reads the
    // attribute through `$getattr` itself and was then handed the wrapper.
    //
    // It is covered since, by a wrapper that takes its target from the first
    // argument at the call rather than from a receiver it does not have, and by
    // calling the descriptor through Python's own protocol. The limit was a
    // limit of one attempt, not of the shape. `tests/type-mutator.test.js` holds
    // it, and this paragraph stays because the sentence it replaces stood here
    // for a fortnight, saying *measured* about something that had stopped being
    // true.

    test('and the two spellings compose', () => {
        const { read, click } = setup();

        click('type');
        click('instance');

        expect(read()).toBe('[2, 1]');
    });
});
