// **An element a capital starts that holds a dash takes its class with
// Python's truth**, as every element does: `onElement` asked for a lowercase
// first letter where Svelte asks only that the tag be no component, so
// `<Dashed-Probe class={classes}>` went without `__brycomp_class`, and an empty list,
// true in JavaScript, kept its class on.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DashedTagClasses from './fixtures/DashedTagClasses.svelte';

const TAGS = ['first', 'parts', 'upper'];
const FORMS = ['named', 'spread', 'list'];

test('a dashed element a capital starts reads its classes with Python truth', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(DashedTagClasses, { target });
    flushSync();

    const read = () =>
        TAGS.flatMap((tag) =>
            FORMS.map((form) => [...target.querySelector(`[data-k="${tag}-${form}"]`).classList].sort().join(' '))
        );
    const seen = [read()];

    for (const _ of [1, 2]) {
        instance.change();
        flushSync();
        seen.push(read());
    }

    const expected = (active) =>
        TAGS.flatMap(() =>
            FORMS.map((form) => [form === 'list' && 'base', active && 'active', 'visible'].filter(Boolean).sort().join(' '))
        );

    expect(seen).toEqual([expected(false), expected(true), expected(false)]);
});
