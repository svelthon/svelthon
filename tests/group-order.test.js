// **A checkbox group is the checked inputs, in the order they sit in the
// document.**
//
// This built the list from the click history: the value ticked last went to the
// end, so ticking `b` then `a` gave `['b', 'a']` where Svelte gives
// `['a', 'b']`. The selection was right and its order was ours — which is
// invisible to a test whose clicks happen to run left to right, and that is
// exactly what the test in `groups.test.js` does.
//
// Svelte's own binding walks the group's inputs (`get_binding_group_value`), so
// the reference here is **Svelte, executed**: the same markup in its own
// language, clicked the same way, read at run time. A literal would pin today's
// rule; the witness tells us the day the rule moves.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupOrder from './fixtures/GroupOrder.svelte';
import GroupOrderNative from './fixtures/GroupOrderNative.svelte';

const after = (Component, clicks) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    for (const key of clicks) {
        target.querySelector(`input[data-k="${key}"]`).click();
        flushSync();
    }

    return target.querySelector('p[data-k="picked"]').textContent;
};

describe.for([
    // Left to right, which is the order the old code got right by accident.
    [['a', 'b', 'c']],
    // And every order that tells the two rules apart.
    [['b', 'a']],
    [['c', 'a', 'b']],
    [['c', 'b', 'a']],
    // Ticked, unticked, ticked again: the value goes back where it belongs and
    // not to the end.
    [['b', 'a', 'b', 'b']]
])('clicking %s', ([clicks]) => {
    test('gives what Svelte gives for the same markup', () => {
        expect(after(GroupOrder, clicks)).toBe(after(GroupOrderNative, clicks));
    });
});

// The witness the comparison cannot give on its own: that both are the *right*
// answer and not the same wrong one.
test('and that answer is the document order', () => {
    expect(after(GroupOrder, ['c', 'a', 'b'])).toBe('a,b,c');
});
