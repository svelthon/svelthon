// A select bound to Python shows what the model holds and writes back what is
// chosen, as a select bound in Svelte does: a multiple one over a list, and a
// single one in each spelling of its binding, over floats, ints and dicts
// holding a float, in both directions.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SelectBindings from './fixtures/SelectBindings.svelte';
import SelectBindingsNative from './fixtures/SelectBindingsNative.svelte';

// `after` is a multiple select whose `multiple` comes after its binding.
const KEYS = ['many', 'after', 'long', 'short'];

const run = (component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(component, { target, props: { kind } });
    const shown = () => KEYS.map((k) => [...target.querySelector(`[data-k="${k}"]`).options].map((one) => one.selected));
    const choose = () => {
        for (const k of KEYS) {
            const select = target.querySelector(`[data-k="${k}"]`);

            [...select.options].forEach((one, i) => (one.selected = i === 0));
            select.dispatchEvent(new Event('change'));
        }
        flushSync();
    };

    flushSync();
    const first = shown();

    instance.second();
    flushSync();
    const programmed = shown();

    choose();

    return { first, programmed, chosen: instance.held() };
};

describe.for(['float', 'int', 'dict'])('over %s options', (kind) => {
    test('each select shows and writes back what a Svelte one does', () => {
        const native = run(SelectBindingsNative, kind);
        const python = run(SelectBindings, kind);

        // The witness: the model's first option shown, then its second.
        expect(native.first).toEqual(KEYS.map(() => [true, false]));
        expect(native.programmed).toEqual(KEYS.map(() => [false, true]));

        expect(python.first).toEqual(native.first);
        expect(python.programmed).toEqual(native.programmed);
        expect(python.chosen).toEqual(native.chosen);
    });
});
