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

    // Not covered, and measured rather than assumed: `add = list.append` hands
    // back a **method descriptor**, an object and not a function, so the wrapper
    // the bound path uses does not fit it. Wrapping it in one anyway was tried
    // and turned the two tests above red as well — the call interception reads
    // the attribute through `$getattr` itself and was then handed the wrapper.
    //
    // `add(xs, 3)` therefore mutates without notifying, as it did before. The
    // shape the audit measured, `list.append(xs, 2)`, is the one above.

    test('and the two spellings compose', () => {
        const { read, click } = setup();

        click('type');
        click('instance');

        expect(read()).toBe('[2, 1]');
    });
});
