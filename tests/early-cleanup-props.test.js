// **Another component's cleanup reads a Python component's names before the
// first flush**: Svelte hands a cleanup run before the batch that wrote a
// state ends what the state held before, and a cell is born `undefined`, so a
// child's cleanup that read the props its Python parent passed called the
// parent's expression function as that `undefined`, `get(...) is not a
// function`, and a function a Python component handed out read its global as
// not bound, NameError. Each name is read off what its cell holds as itself
// when the cell holds nothing (`orHeld`), whoever reads it.
//
// The ways tried before each left some reader out: a write of the body made
// the name's birth, which cost every mount a root per name; reserved for a
// page whose text showed a root or a pre effect, it missed a child written in
// JavaScript and an effect spelled over two lines; reserved for a component
// whose markup renders one, it missed `{@ render …}` and a function a component
// that renders none hands its parent.
import { test, expect } from 'vitest';
import { mount, unmount } from './mounted.js';
import EarlyJsParent from './fixtures/EarlyJsParent.svelte';
import EarlyPropParent from './fixtures/EarlyPropParent.svelte';
import EarlySnippetHost from './fixtures/EarlySnippetHost.svelte';
import EarlyCallbackHost from './fixtures/EarlyCallbackHost.svelte';

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

test('and one the snippet a Python component renders with `{@ render}` mounts', () => {
    expect(capturing(EarlySnippetHost)).toEqual(['run:7', 'clean:7']);
});

test('and a JavaScript cleanup calls a function its Python child handed it, which reads a global', () => {
    expect(capturing(EarlyCallbackHost)).toEqual(['publish:7', 'clean:7']);
});
