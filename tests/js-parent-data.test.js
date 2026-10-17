// A Svelte parent hands a Python child its own objects and arrays: they arrive
// as JavaScript's, the parent's very values, which a write reaches. Python
// reads them as the dict and the list they hold: `len`, `get`, `keys` and
// `items` on a plain object, `count` and `index` on an array, which Brython's
// `JSObject` and `JavascriptArray` lacked, and the page died on an
// `AttributeError` where the author had written `data.get("a")`.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import JsParentData from './fixtures/JsParentData.svelte';

test('a Python child reads what a Svelte parent hands as a dict and a list', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const app = mount(JsParentData, { target });

    flushSync();
    expect(target.querySelector('[data-k="data"]').textContent).toBe("2 1 0 ['a', 'b'] [('a', 1), ('b', 2)]");
    expect(target.querySelector('[data-k="items"]').textContent).toBe('2 1 3');

    unmount(app);
    target.remove();
});
