import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupTypes from './fixtures/GroupTypes.svelte';
import FloatForm from './fixtures/FloatForm.svelte';
import GroupValueShapes from './fixtures/GroupValueShapes.svelte';
import GroupValueShapesNative from './fixtures/GroupValueShapesNative.svelte';
import GroupMixedValues from './fixtures/GroupMixedValues.svelte';
import GroupMixedValuesNative from './fixtures/GroupMixedValuesNative.svelte';

// The value a group binds is the one the field holds, however it was written:
// longhand, shorthand, spread, a longhand a spread overrides, and an
// expression that answers anew at each call, braced or alone between quotes.
// Each checkbox, ticked, then
// unticked, answers what Svelte's own answers. The group compiled the tag's
// `value` text on its own: it saw neither the shorthand nor the spread, and
// held "1" for 1, or the 0 the spread had replaced, and a counter called
// again gave the group another value than the field's.
test('a group binds the value its field holds, however written', () => {
    const states = (Component) => {
        let calls = 0;
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target, props: { next_value: () => ++calls } });
        flushSync();

        const at = (key) => target.querySelector(`[data-k="${key}"]`);

        return ['long', 'short', 'spread', 'ordered', 'counted', 'quoted'].map((key) => {
            const seen = [at(key).checked];

            for (let click = 0; click < 2; click++) {
                at(key).click();
                flushSync();
                seen.push(at(key).checked, at(`${key}-model`).textContent);
            }

            return [key, ...seen];
        });
    };

    expect(states(GroupValueShapes)).toEqual(states(GroupValueShapesNative));
});

// And text holding an interpolation, whose counter is called a number of times
// that is each framework's own, so what is compared is whether the model holds
// the value the field shows, and the control's state. Evaluated a second time
// for the group, `"v-{next_value()}"` showed `v-1` and wrote `v-2`, and the
// radio unchecked itself.
test('a group binds the value its field holds, written as text around an interpolation', () => {
    const states = (Component) => {
        let calls = 0;
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target, props: { next_value: () => ++calls } });
        flushSync();

        const at = (key) => target.querySelector(`[data-k="${key}"]`);

        return ['radio', 'first', 'box', 'twice'].map((key) => {
            const seen = [at(key).checked];

            for (let click = 0; click < 2; click++) {
                at(key).click();
                flushSync();
                seen.push(at(key).checked, at(`${key}-model`).textContent === at(key).value);
            }

            return [key, ...seen];
        });
    };

    expect(states(GroupMixedValuesNative)).toEqual([
        ['radio', false, true, true, true, true],
        ['first', false, true, true, true, true],
        ['box', false, true, true, false, false],
        ['twice', false, true, true, false, false]
    ]);
    expect(states(GroupMixedValues)).toEqual(states(GroupMixedValuesNative));
});

// A binding compares a container by identity: a dict holding a float keeps its
// option selected, and a group of floats keeps the box already ticked.
describe('a form over floats', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(FloatForm, { target });
        flushSync();
        return (key) => target.querySelector(`[data-k="${key}"]`);
    };

    test('a select keeps the dict it is bound to selected', () => {
        expect(setup()('select').selectedIndex).toBe(0);
    });

    test('a second box ticked keeps the first', () => {
        const at = setup();
        expect(at('a').checked).toBe(true);

        at('b').click();
        flushSync();
        expect(at('picked').textContent).toBe('[0.5, 1.5]');
    });
});

// What a group binds is the author's value, not the DOM's spelling of it.
//
// `bind:group` is compiled to an action, and the action read `node.value`, which
// is text: `value={1}` came back as "1". So a number never matched the value it
// was written from, the initial button was empty, and clicking a checkbox left
// `[1, '1']` behind — the same choice under two types.
//
// The typed value is read where Svelte wrote it on the node: `__brycomp_value` for a
// spread, the cache of `set_value` for a longhand or a shorthand (`group`).
describe('a group keeps the type of the value it was given', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(GroupTypes, { target });
        flushSync();

        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`input[data-k="${k}"]`).click();
                flushSync();
            },
            filled: (prefix) =>
                [...target.querySelectorAll(`input[data-k^="${prefix}"]`)]
                    .filter((one) => one.checked)
                    .map((one) => one.dataset.k)
                    .join(' ')
        };
    };

    test('a radio filled from a number', () => {
        const { read, click, filled } = setup();

        expect(filled('r-')).toBe('r-2');
        click('r-3');
        expect(read('chosen')).toBe('3');
        expect(filled('r-')).toBe('r-3');
    });

    test('and the number stays a number', () => {
        const { read, click } = setup();

        expect(read('chosen-type')).toBe('int');
        click('r-3');
        expect(read('chosen-type')).toBe('int');
    });

    test('a checkbox group collects numbers', () => {
        const { read, click, filled } = setup();

        expect(filled('c-')).toBe('c-1');
        click('c-2');
        expect(read('picked')).toBe('[1, 2]');
        expect(read('picked-types')).toBe("['int', 'int']");
    });

    test('and unchecking removes the one that is there', () => {
        // The removal compared the same two spellings, so a number was never
        // found and the list only ever grew.
        const { read, click } = setup();

        click('c-1');
        expect(read('picked')).toBe('[]');
    });

    test('a float, which is an object and not a number', () => {
        const { read, click, filled } = setup();

        expect(filled('f-')).toBe('f-0.5');
        click('f-1.5');
        expect(read('ratio')).toBe('1.5');
        expect(read('ratio-type')).toBe('float');
        expect(filled('f-')).toBe('f-1.5');
    });

    test('the value may be written before the binding', () => {
        const { read, click, filled } = setup();

        expect(filled('b-')).toBe('b-2');
        click('b-1');
        expect(read('chosen')).toBe('1');
        expect(read('chosen-type')).toBe('int');
    });
});
