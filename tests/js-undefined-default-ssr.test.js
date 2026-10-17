// @vitest-environment node
//
// The server half of `js-undefined-default.test.js`: a key's default stands
// for a JavaScript member that is missing or `undefined` on a server as in a
// browser, where `{value: undefined}` rendered None.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import { cases, row } from './fixtures/js_undefined_rows.js';
import JsUndefinedDefault from './fixtures/JsUndefinedDefault.svelte';
import JsUndefinedDefaultNative from './fixtures/JsUndefinedDefaultNative.svelte';

// The text as the server writes it into the page, `&` and `<` escaped.
const escaped = (text) => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;');

test.for(cases)('%s: %s, %s record, value %s, on a server', ([language, place, shape, content, shown]) => {
    const Component = language === 'Python' ? JsUndefinedDefault : JsUndefinedDefaultNative;
    let reads = 0;
    const { body } = render(Component, { props: { place, row: row(shape, content, () => (reads += 1)) } });

    expect(body).toContain(`<p>${escaped(shown)}</p>`);
    expect(reads).toBe(shape === 'getter' && content !== 'absent' ? 1 : 0);
});
