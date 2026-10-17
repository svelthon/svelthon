// **An option whose value is None is selected when the model holds None**, as
// one whose value is `undefined` is in Svelte, and stays so once chosen. The
// option's None was `undefined`, the absence at the DOM, and the list's None the
// `null` a list's view reads, so the two never met. **And one whose value is
// `javascript.NULL` when the model holds it**, as one whose value is `null` is:
// the list's items were read with every `null` made `undefined`, which met the
// None option instead, before and after the NULL one was chosen.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SelectNone from './fixtures/SelectNone.svelte';
import SelectNoneNative from './fixtures/SelectNoneNative.svelte';

const run = (Component, held, pick) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { held } });
    flushSync();

    const select = target.querySelector('select');
    const shown = () => [...select.options].map((one) => one.selected);
    const before = shown();

    [...select.options].forEach((one, at) => (one.selected = at === pick));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    return { before, after: shown(), chosen: instance.chosen() };
};

test.for([
    ['None', 'none', [true, false, false]],
    ['javascript.NULL', 'null', [false, true, false]],
    ['1', 'one', [false, false, true]]
])('a multiple select whose model holds %s shows and keeps a None or a NULL option as Svelte does', ([, held, before]) => {
    for (const [pick, after, chosen] of [
        [0, [true, false, false], [[true, false]]],
        [1, [false, true, false], [[false, true]]]
    ]) {
        const native = run(SelectNoneNative, held, pick);
        const python = run(SelectNone, held, pick);

        expect(native).toEqual({ before, after, chosen });
        expect(python).toEqual(native);
    }
});
