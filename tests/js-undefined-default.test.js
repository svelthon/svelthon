// **A key's default stands for a JavaScript member that is missing or
// `undefined`, as in Svelte.** `{value=7}` read off a row JavaScript hands over
// rendered None for `{value: undefined}`: the member had crossed into Python,
// where `undefined` is None, before the default was decided. A `null` given on
// purpose stays `null`, `javascript.NULL`, and a set value stays itself, in each, a snippet and
// await, for a plain record, one with an `ob_type` field and a getter, which
// is read once.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { cases, row } from './fixtures/js_undefined_rows.js';
import JsUndefinedDefault from './fixtures/JsUndefinedDefault.svelte';
import JsUndefinedDefaultNative from './fixtures/JsUndefinedDefaultNative.svelte';

test.for(cases)('%s: %s, %s record, value %s', async ([language, place, shape, content, shown]) => {
    const Component = language === 'Python' ? JsUndefinedDefault : JsUndefinedDefaultNative;
    const target = document.body.appendChild(document.createElement('div'));
    let reads = 0;

    mount(Component, { target, props: { place, row: row(shape, content, () => (reads += 1)) } });
    flushSync();
    await Promise.resolve();
    flushSync();

    expect(target.querySelector('p').textContent).toBe(shown);
    expect(reads).toBe(shape === 'getter' && content !== 'absent' ? 1 : 0);
});
