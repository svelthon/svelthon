// @vitest-environment node
//
// The server half of `select-array-option.test.js`: the option the model holds,
// None or the array, is the one rendered `selected`, a spread written after
// `multiple` and a spread alone included.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import SelectArrayOption from './fixtures/SelectArrayOption.svelte';
import SelectArrayOptionNative from './fixtures/SelectArrayOptionNative.svelte';

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        ['spread', 'after multiple', 'class word', 'plain'].flatMap((form) => ['none', 'array'].map((held) => [language, form, held]))
    )
)('%s: a single select, %s, model %s, renders its option selected on a server', ([language, form, held]) => {
    const Component = language === 'Python' ? SelectArrayOption : SelectArrayOptionNative;
    const { body } = render(Component, { props: { original: [1, 2], form, held } });
    const selected = [...body.matchAll(/<option([^>]*)>/g)].map(([, attributes]) => /\bselected\b/.test(attributes));

    expect(selected).toEqual(held === 'array' ? [true, false] : [false, true]);
});
