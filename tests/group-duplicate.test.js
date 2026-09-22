// **Two controls may stand for one choice.** A form shows the same option in
// two sections, and both boxes are then bound to the same list.
//
// The collection read each checked input as an entry of its own, so the value
// went in twice; and unticking one of them left the other checked, so the value
// came straight back and the reader could not remove it. Neither is an ordering
// difference — one is a duplicate in the data, the other is a selection that
// cannot be undone.
//
// Svelte's `get_binding_group_value` is two lines: a `Set` of the checked
// values, then a `delete` of the one whose control just went off. Read here with
// Python's `==` rather than a JavaScript `Set`, because two Brython values that
// are equal are rarely the same object.
//
// The reference is Svelte executed, on the same markup in its own language. And
// the group is written with a **duplicate in the middle position**, so a
// collection that happens to be ordered right cannot pass by accident.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupDuplicate from './fixtures/GroupDuplicate.svelte';
import GroupDuplicateNative from './fixtures/GroupDuplicateNative.svelte';

const after = (Component, clicks) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    for (const key of clicks) {
        target.querySelector(`input[data-k="${key}"]`).click();
        flushSync();
    }

    return {
        picked: target.querySelector('p[data-k="picked"]').textContent,
        checked: ['a1', 'b', 'a2']
            .filter((k) => target.querySelector(`input[data-k="${k}"]`).checked)
            .join(',')
    };
};

describe.for([
    // The duplicate alone: both controls show it, and it is in the list once.
    [['a1']],
    // And then another value, which is where the second copy used to appear.
    [['a1', 'b']],
    // Ticked and unticked: the other control carrying the same value must not
    // put it back.
    [['a1', 'a1']],
    // Unticked from the *other* control of the pair.
    [['a1', 'a2']],
    [['a1', 'b', 'a2']],
    [['b', 'a2', 'a1']]
])('clicking %s', ([clicks]) => {
    test('gives what Svelte gives for the same markup', () => {
        expect(after(GroupDuplicate, clicks)).toEqual(after(GroupDuplicateNative, clicks));
    });
});

// The witness the comparison cannot give on its own: that both are the right
// answer and not the same wrong one.
test('and that answer holds the value once, and lets it go', () => {
    expect(after(GroupDuplicate, ['a1', 'b']).picked).toBe('a,b');
    expect(after(GroupDuplicate, ['a1', 'a1']).picked).toBe('');
});
