// **Two rows of one form are two groups.**
//
// A group is identified by three things and not two: the component instance,
// the text of the binding, and **the row**. Inside an `{#each}` every row
// shares the first two, so a registry keyed on those alone gathers the whole
// loop: ticking a box on the second row wrote the first row's selection into it
// as well, and a form recorded choices the reader never made for that item.
// `group-shared-default.test.js` covers rows that hold one list.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupRows from './fixtures/GroupRows.svelte';
import GroupSharedRow from './fixtures/GroupSharedRow.svelte';
import GroupSharedRowUnindexed from './fixtures/GroupSharedRowUnindexed.svelte';
import GroupSharedRowNative from './fixtures/GroupSharedRowNative.svelte';
import GroupSharedNested from './fixtures/GroupSharedNested.svelte';
import GroupSharedNestedNative from './fixtures/GroupSharedNestedNative.svelte';
import GroupSharedRowSpelled from './fixtures/GroupSharedRowSpelled.svelte';
import GroupSharedShadowed from './fixtures/GroupSharedShadowed.svelte';
import GroupSharedShadowedNative from './fixtures/GroupSharedShadowedNative.svelte';
import GroupSharedSiblings from './fixtures/GroupSharedSiblings.svelte';
import GroupSharedSiblingsNative from './fixtures/GroupSharedSiblingsNative.svelte';
import GroupSharedIndexOnly from './fixtures/GroupSharedIndexOnly.svelte';
import GroupSharedIndexOnlyNative from './fixtures/GroupSharedIndexOnlyNative.svelte';

// **And two rows holding one object are two groups**, as Svelte keeps them: a
// group per iteration, by its index. Told apart by the values the binding
// mentions alone, the two rows were one group, and the second click wrote the
// first row's box into the shared field as well.
test.for([
    ['an index written', GroupSharedRow, GroupSharedRowNative],
    ['no index written', GroupSharedRowUnindexed, GroupSharedRowNative],
    ['in a loop read from an outer one', GroupSharedNested, GroupSharedNestedNative],
    // The row's name declared under one spelling and read under another Python
    // takes for the same: the loop's index was looked for by spelling, and the
    // two rows were one group again.
    ['its name declared ﬁ', GroupSharedRowSpelled, GroupSharedRowNative, { way: 'declared ﬁ' }],
    ['its name read ﬁ', GroupSharedRowSpelled, GroupSharedRowNative, { way: 'read ﬁ' }],
    ['its name declared ﬁ, no index written', GroupSharedRowSpelled, GroupSharedRowNative, { way: 'unindexed' }],
    // The outer index read by its name where the inner loop declares the same
    // one: both rows read the inner index, 0, and were one group.
    ['an inner loop declaring the outer index name', GroupSharedShadowed, GroupSharedShadowedNative],
    // And two loops that each declare `row`, as Svelte keys a group by each
    // name's declaration: told by the object alone, they were one group.
    ['in two loops each declaring it', GroupSharedSiblings, GroupSharedSiblingsNative],
    // And an outer loop that names no row, only its index, keyed by it or not:
    // noted in the other form alone, it was no loop to the group.
    ['under an outer loop naming its index alone', GroupSharedIndexOnly, GroupSharedIndexOnlyNative],
    ['under an outer loop naming its index alone, keyed by it', GroupSharedIndexOnly, GroupSharedIndexOnlyNative, { keyed: true }]
])('rows holding one object stay two groups, %s', ([, Python, Native, props = {}]) => {
    const steps = (component, given = {}) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(component, { target, props: given });
        const boxes = () => [...target.querySelectorAll('input')].map((one) => one.checked);
        const seen = [];

        flushSync();

        for (const k of ['0', '1']) {
            target.querySelector(`input[data-k="${k}"]`).click();
            flushSync();
            seen.push([String(instance.read()), boxes()]);
        }

        return seen;
    };

    const native = steps(Native);

    expect(native).toEqual([
        ['0|0', [true, false]],
        ['1|1', [false, true]]
    ]);
    expect(steps(Python, props)).toEqual(native);
});

describe('checkbox groups in separate rows', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(GroupRows, { target });
        flushSync();

        return {
            read: () => String(instance.read()),
            click: (k) => {
                target.querySelector(`input[data-k="${k}"]`).click();
                flushSync();
            },
            checked: (k) => target.querySelector(`input[data-k="${k}"]`).checked
        };
    };

    test('do not take each other’s selections', () => {
        const { read, click } = setup();

        click('0-a');
        expect(read()).toBe('a / ');

        // The second row is the one that used to inherit: it collected every
        // checked input of the loop, not its own.
        click('1-b');
        expect(read()).toBe('a / b');

        click('1-a');
        expect(read()).toBe('a / a,b');
    });

    // And the controls say the same thing as the model, which is the half a
    // read of the model alone cannot show.
    test('and the controls follow their own row', () => {
        const { click, checked } = setup();

        click('1-b');

        expect(checked('1-b')).toBe(true);
        expect(checked('0-b')).toBe(false);
    });

    // Order is per row too: the fix for one must not have cost the other.
    test('while keeping document order within a row', () => {
        const { read, click } = setup();

        click('0-b');
        click('0-a');

        expect(read()).toBe('a,b / ');
    });
});
