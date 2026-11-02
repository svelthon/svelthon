// **A name no statement binds is no name while nothing has written it**: a typo
// in the template, `{conut}` for `count`, raises `NameError` at its line, as in
// Python and as Svelte's `conut is not defined`. Given a cell so that a write
// through `globals()` is followed, it was read as an absence, the None of a name
// assigned in a branch that did not run, and rendered nothing without a word;
// `{conut + 1}` raised a `TypeError` about None that named no `conut`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TemplateTypo from './fixtures/TemplateTypo.svelte';
import TemplateTypoSum from './fixtures/TemplateTypoSum.svelte';

test.for([
    ['TemplateTypo', TemplateTypo],
    ['TemplateTypoSum', TemplateTypoSum]
])('a typo in the template raises NameError at its line: %s', ([file, Component]) => {
    const message = new RegExp(`NameError: name 'conut' is not defined .*${file}\\.svelte:6`);
    const target = document.body.appendChild(document.createElement('div'));

    try {
        expect(() => {
            mount(Component, { target });
            flushSync();
        }).toThrow(message);
    } finally {
        target.remove();
    }
});
