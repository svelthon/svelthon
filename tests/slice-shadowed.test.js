// **A template `:=` through a slice writes the engine's slice**, under the
// compiler's name: the rewrite called `slice` by its visible name, so a `slice`
// of the author's ran in its place, a function's `0` writing `[9]` into the
// first item and a number raising `'int' object is not callable`. And a colon
// a `lambda` takes is no slice's: `1 if True else lambda: 2` is the key `1`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SliceShadowed from './fixtures/SliceShadowed.svelte';

test('a template walrus through a slice writes the slice, whatever the author named slice', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(SliceShadowed, { target });
    flushSync();

    const click = (key) => {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
    };

    click('function');
    instance.number();
    click('number');
    click('lambda');

    expect(target.querySelector('output').textContent).toBe('[9, 2, 3]|[1, 5]|{1: 42}');
});
