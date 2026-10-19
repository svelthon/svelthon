// @vitest-environment node
//
// **A group's box is checked on the server whatever spelling its static
// attributes have**, unquoted as HTML and Svelte allow: `type=checkbox` is a
// checkbox and `value=a` is the value `"a"`. Read only behind a quote or a
// brace, neither was an attribute: the checkbox was compared as a radio, the
// value was none, and the page served before any script checked no box the
// model held.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import GroupUnquoted from './fixtures/GroupUnquoted.svelte';
import GroupUnquotedNative from './fixtures/GroupUnquotedNative.svelte';

const boxes = (Component) =>
    [...render(Component).body.matchAll(/<input[^>]*>/g)].map(([tag]) => [
        tag.match(/type="([^"]*)"/)[1],
        tag.match(/value="([^"]*)"/)[1],
        /\schecked(=|\s|\/|>)/.test(tag)
    ]);

// The fixtures' pairs of boxes, in their order, `a` held and `b` not.
test.for([
    [0, 'checkbox', 'a quoted type and an unquoted value'],
    [1, 'checkbox', 'an unquoted type and a quoted value'],
    [2, 'checkbox', 'both unquoted'],
    [3, 'radio', 'a quoted type and an unquoted value'],
    [4, 'radio', 'both unquoted']
])('pair %i, a %s group with %s, renders on a server as Svelte’s', ([pair, type]) => {
    const served = [
        [type, 'a', true],
        [type, 'b', false]
    ];

    expect(boxes(GroupUnquotedNative).slice(2 * pair, 2 * pair + 2)).toEqual(served);
    expect(boxes(GroupUnquoted).slice(2 * pair, 2 * pair + 2)).toEqual(served);
});
