// @vitest-environment node
//
// The server half of `dashed-tag-classes.test.js`: the HTML a server renders
// for an element a capital starts that holds a dash leaves out a class whose
// value is an empty list, as for any element.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import DashedTagClasses from './fixtures/DashedTagClasses.svelte';

test('the server leaves out the class an empty list stands for on a dashed element a capital starts', () => {
    const body = render(DashedTagClasses).body;
    const classes = [...body.matchAll(/<[\w-]+([^>]*)>/g)]
        .map(([, attributes]) => [attributes.match(/data-k="([^"]*)"/)?.[1], attributes.match(/class="([^"]*)"/)?.[1]])
        .filter(([key]) => key)
        .map(([key, value]) => [key, (value ?? '').split(/\s+/).filter(Boolean).sort().join(' ')]);

    expect(Object.fromEntries(classes)).toEqual(
        Object.fromEntries(
            ['first', 'parts', 'upper'].flatMap((tag) =>
                ['named', 'spread', 'list'].map((form) => [`${tag}-${form}`, form === 'list' ? 'base visible' : 'visible'])
            )
        )
    );
});
