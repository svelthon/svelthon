// **A single select writes back the very array its chosen option holds**, as
// Svelte writes it, whether a spread may make it multiple or not, and whether
// the option is written here or put there by a Svelte child. With a spread, the
// write took an array Svelte wrote for the choice of a multiple select, and
// copied the option's JavaScript array into a Python list: the model lost the
// array, and the select its option. Then it told the two apart by the arrays
// the component had handed Svelte, which a child's options never are.
//
// **And it shows the option its model holds, None or the array**, from the
// start and after each choice. A spread written after `multiple`, which turns
// it off, left the select read and written as multiple, the array's option
// never selected and the array copied; and a spread alone read the model as
// Python's, its None no option's `undefined`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SelectArrayOption from './fixtures/SelectArrayOption.svelte';
import SelectArrayOptionNative from './fixtures/SelectArrayOptionNative.svelte';

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        ['spread', 'after multiple', 'plain'].flatMap((form) =>
            [false, true].flatMap((child) => ['none', 'array'].map((held) => [language, form, child, held]))
        )
    )
)('%s: a single select, %s, options of a child %s, model %s, shows and writes back the value of its option', ([language, form, child, held]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const original = [1, 2];
    const instance = mount(language === 'Python' ? SelectArrayOption : SelectArrayOptionNative, {
        target,
        props: { original, form, child, held }
    });
    flushSync();

    const select = target.querySelector('select');
    const shown = () => [select.multiple, select.selectedIndex, ...instance.model().slice(1)];
    const states = [shown()];

    for (const pick of [0, 1, 0]) {
        [...select.options].forEach((one, at) => (one.selected = at === pick));
        select.dispatchEvent(new Event('change', { bubbles: true }));
        flushSync();
        states.push(shown());
    }

    expect([states, instance.model()[0]]).toEqual([
        [
            held === 'array' ? [false, 0, true, false] : [false, 1, false, true],
            [false, 0, true, false],
            [false, 1, false, true],
            [false, 0, true, false]
        ],
        'JavascriptArray'
    ]);
});
