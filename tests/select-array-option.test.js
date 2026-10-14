// **A single select writes back the very array its chosen option holds**, as
// Svelte writes it, whether a spread may make it multiple or not, and whether
// the option is written here or put there by a Svelte child. With a spread, the
// write took an array Svelte wrote for the choice of a multiple select, and
// copied the option's JavaScript array into a Python list: the model lost the
// array, and the select its option. Then it told the two apart by the arrays
// the component had handed Svelte, which a child's options never are.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SelectArrayOption from './fixtures/SelectArrayOption.svelte';
import SelectArrayOptionNative from './fixtures/SelectArrayOptionNative.svelte';

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [true, false].flatMap((spread) => [false, true].map((child) => [language, spread, child]))
    )
)('%s: a single select, spread %s, options of a child %s, writes back the JavaScript array of its option', ([language, spread, child]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const original = [1, 2];
    const instance = mount(language === 'Python' ? SelectArrayOption : SelectArrayOptionNative, {
        target,
        props: { original, spread, child }
    });
    flushSync();

    const select = target.querySelector('select');
    select.options[0].selected = true;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    expect([instance.model(), select.selectedIndex]).toEqual([['JavascriptArray', true], 0]);
});
