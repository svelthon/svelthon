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
import GroupNumericKeys from './fixtures/GroupNumericKeys.svelte';
import GroupSignedKeys from './fixtures/GroupSignedKeys.svelte';

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

// `bag[1]`, `bag[1.0]` and `bag[True]` are one entry of the dict, Python
// comparing numeric keys by value, so they are one group; `bag[one]` is another
// expression, which Svelte keeps apart too. A number that is not the key keeps
// its class: `str(1)` and `str(True)` are `'1'` and `'True'`, two entries, where
// they were one group writing both. `python3` on the same dict.
test('equal numeric keys are one target, and only the key is compared by value', async () => {
    const target = await mounted(GroupNumericKeys);
    const models = [];

    for (const key of ['a', 'b', 'c', 'd']) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        models.push(target.querySelector('p').textContent);
    }
    for (const key of ['e', 'f']) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
    }

    expect(models).toEqual(['a', 'a,b', 'a,b,c', 'd']);
    expect(target.querySelector('output').textContent).toBe("{'1': ['e'], 'True': ['f']}");
});

// A sign in front of a number at a key is the number it makes: `bag[1] is
// bag[+1]` and `bag[0] is bag[-0.0]` in `python3`, so each pair is one group,
// where the second box of a pair cleared the first. Svelte keeps `+1` apart
// from `1`, as it keeps every two spellings it does not parse as Python.
test('a signed number at a key is the number it makes', async () => {
    const target = await mounted(GroupSignedKeys);
    const models = [];

    for (const key of ['a', 'b', 'c', 'd', 'e']) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
        models.push(target.querySelector('p').textContent);
    }

    expect(models).toEqual(['a|', 'a,b|', 'a,b,c|', 'a,b,c|d', 'a,b,c|d,e']);
    expect([...target.querySelectorAll('input')].map((one) => one.checked)).toEqual([true, true, true, true, true]);
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
