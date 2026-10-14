// **An option whose value is None is selected when the model holds None**, as
// one whose value is `undefined` is in Svelte, and stays so once chosen. The
// option's None was `undefined`, the absence at the DOM, and the list's None the
// `null` a list's view reads, so the two never met.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SelectNone from './fixtures/SelectNone.svelte';
import SelectNoneNative from './fixtures/SelectNoneNative.svelte';

const run = (Component, held) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { held } });
    flushSync();

    const select = target.querySelector('select');
    const shown = () => [...select.options].map((one) => one.selected);
    const before = shown();

    [...select.options].forEach((one, at) => (one.selected = at === 0));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    return { before, after: shown(), chosen: instance.chosen() };
};

test.for([
    ['None', 'none', [true, false]],
    ['1', 'one', [false, true]]
])('a multiple select whose model holds %s shows and keeps a None option as Svelte does', ([, held, before]) => {
    const native = run(SelectNoneNative, held);
    const python = run(SelectNone, held);

    expect(native).toEqual({ before, after: [true, false], chosen: [true] });
    expect(python).toEqual(native);
});
