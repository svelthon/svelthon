// A binding's target was told by its text. Three checkboxes bound to one dict
// field spelled `bag["selected"]`, `bag[ "selected" ]` and `bag['selected']`
// made three groups, each writing its own selection over the others, and
// `bind:value={(amount)}` wrote a local of the setter, the parentheses hiding
// the name from the test for a bare one. Both are read off the tree Python
// parses, where the three spellings are one `Subscript` and `(amount)` the
// `Name` `amount`. The witness for the group is Svelte, with the same three
// spellings in JavaScript.
import { test, expect } from 'vitest';
import { flushSync } from 'svelte';
import { mount } from './mounted.js';
import GroupSpellings from './fixtures/GroupSpellings.svelte';
import GroupSpellingsNative from './fixtures/GroupSpellingsNative.svelte';
import ParenthesizedTargets from './fixtures/ParenthesizedTargets.svelte';

const mounted = async (Component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();
    await Promise.resolve();

    return target;
};

const clicks = async (Component) => {
    const target = await mounted(Component);
    const states = [];

    for (const key of ['b', 'a', 'c', 'b']) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        states.push([target.querySelector('p').textContent, [...target.querySelectorAll('input')].map((one) => one.checked)]);
    }

    return states;
};

test('three spellings of one target are one group, as in Svelte', async () => {
    const native = await clicks(GroupSpellingsNative);

    expect(native.map(([model]) => model)).toEqual(['b', 'a,b', 'a,b,c', 'a,c']);
    expect(await clicks(GroupSpellings)).toEqual(native);
});

test('a parenthesized name is the name it holds, in the script and in the markup', async () => {
    const target = await mounted(ParenthesizedTargets);

    for (const key of ['script', 'markup']) {
        const input = target.querySelector(`input[data-k="${key}"]`);

        input.value = 'new';
        input.dispatchEvent(new Event('input'));
    }
    target.querySelector('input[data-k="group"]').click();
    flushSync();

    expect([...target.querySelectorAll('output')].map((one) => one.textContent)).toEqual(['new', 'new', 'x']);
});
