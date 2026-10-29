// **A child's cleanup reads the props of its Python parent before the first
// flush**: the parent writes its names as births where its markup renders a
// component, whatever the child is written in and however its effect is
// spelled. Asked of a flag a page raised when a Python module's text showed a
// root or a pre effect, a page with none left the parent unborn: a child
// written in JavaScript raised no flag, nor one whose decorator Python lets
// run over two lines, and the child's `$effect.pre` cleanup, run by an unmount
// before the first flush, called the parent's expression function as the
// `undefined` it was born, `get(...) is not a function`. Alone in its file, so
// that no module with such an effect loads beside it.
import { test, expect } from 'vitest';
import { mount, unmount } from './mounted.js';
import EarlyJsParent from './fixtures/EarlyJsParent.svelte';
import EarlyPropParent from './fixtures/EarlyPropParent.svelte';

const capturing = (Component) => {
    const seen = [];
    const target = document.body.appendChild(document.createElement('div'));
    unmount(mount(Component, { target, props: { capture: (...row) => seen.push(row.join(':')) } }));

    return seen;
};

test('a JavaScript pre cleanup reads the prop its Python parent passes, before the first flush', () => {
    expect(capturing(EarlyJsParent)).toEqual(['run:7', 'clean:7']);
});

test('and a Python one whose decorator runs over two lines', () => {
    expect(capturing(EarlyPropParent)).toEqual(['run:7', 'clean:7']);
});
