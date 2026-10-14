// **A select a spread makes multiple is bound as one written `multiple`**, as
// Svelte binds it, by what the element is. The pair was chosen off the tag's
// text, which names no `multiple`: the model's None missed its option, and a
// choice wrote back a `JavascriptArray` where the written attribute writes a
// list.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpreadMultiple from './fixtures/SpreadMultiple.svelte';
import SpreadMultipleNative from './fixtures/SpreadMultipleNative.svelte';

const run = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();

    const select = target.querySelector('select');
    const shown = () => [...select.options].map((one) => one.selected);
    const before = shown();

    [...select.options].forEach((one, at) => (one.selected = at === 1));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    return { before, after: shown(), model: instance.model() };
};

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [
            ['none', [true, false]],
            ['number', [false, true]]
        ].flatMap(([held, before]) => [true, false].map((spread) => [language, held, spread, before]))
    )
)('%s: a select whose model holds %s, made multiple by a spread %s, is bound as a multiple one', ([language, held, spread, before]) => {
    const Component = language === 'Python' ? SpreadMultiple : SpreadMultipleNative;

    expect(run(Component, { held, spread })).toEqual({ before, after: [false, true], model: 'list' });
});
