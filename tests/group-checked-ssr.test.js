// @vitest-environment node
//
// The server half of `group-checked.test.js`: the component compiles for the
// server too, and checks each box as Svelte's does. Svelte's own writes
// `checked` once per binding, twice on the box both bind, which a parser reads
// as one: what is compared is each box's value and whether it is checked.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GroupChecked from './fixtures/GroupChecked.svelte';
import GroupCheckedNative from './fixtures/GroupCheckedNative.svelte';
import GroupEncodedType from './fixtures/GroupEncodedType.svelte';
import GroupEncodedTypeNative from './fixtures/GroupEncodedTypeNative.svelte';

const boxes = (Component, props) =>
    [...render(Component, { props }).body.matchAll(/<input[^>]*>/g)].map(([tag]) => [
        tag.match(/value="([^"]*)"/)[1],
        /\schecked(=|\s|\/|>)/.test(tag)
    ]);

test.for([
    [false, false],
    [false, true],
    [true, false],
    [true, true]
])('a box bound to a group and to checked renders on a server as Svelte’s, reversed %s, checked first %s', ([reverse, initial]) => {
    expect(boxes(GroupCheckedNative, { reverse, initial })).toEqual([
        ['a', initial],
        ['b', false]
    ]);
    expect(boxes(GroupChecked, { reverse, initial })).toEqual(boxes(GroupCheckedNative, { reverse, initial }));
});

// **A checkbox whose `type` is written with character references is checked
// on a server as one**, as Svelte reads the attribute, decoded. Its notation
// compared, `check&#98;ox` was no checkbox, the group was read as a radio's,
// and the box the model holds was written unchecked.
test('a box whose type holds a character reference is checked on a server as Svelte’s is', () => {
    const checked = (Component) =>
        [...render(Component).body.matchAll(/<input[^>]*>/g)].map(([tag]) => [
            tag.match(/data-k="([^"]*)"/)[1],
            /\schecked(=|\s|\/|>)/.test(tag)
        ]);
    const native = checked(GroupEncodedTypeNative);

    expect(native.every(([, on]) => on)).toBe(true);
    expect(checked(GroupEncodedType)).toEqual(native);
});
