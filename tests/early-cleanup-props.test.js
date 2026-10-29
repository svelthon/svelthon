// **Another component's cleanup reads a Python component's names before the
// first flush**: Svelte hands a cleanup run before the batch that wrote a
// state ends what the state held before, and a cell is born `undefined`, so a
// child's cleanup that read the props its Python parent passed called the
// parent's expression function as that `undefined`, `get(...) is not a
// function`, and a function a Python component handed out read its global as
// not bound, NameError. Each name is read off what its cell holds as itself
// when the cell holds nothing (`orHeld`), whoever reads it and by whichever
// door: its value, the source `globals()` asks whether it is bound, which left
// a function and a derived out, and a store's getter, which handed JavaScript
// `undefined`.
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
import EarlyPresence from './fixtures/EarlyPresence.svelte';
import { events } from './fixtures/early_store_log.js';
import EarlyRows from './fixtures/EarlyRows.svelte';
import { events as rowEvents } from './fixtures/early_rows_driver.svelte.js';
import { flushSync } from 'svelte';

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

test('and `globals()` still binds a function and a derived, whose body it does not run', () => {
    expect(capturing(EarlyPresence)).toEqual(['run:true:true', 'clean:true:true:true']);
});

test('and a store hands JavaScript the value its body wrote, as Python reads it', async () => {
    await import('./fixtures/early_store.svelte.py');

    expect(events).toEqual(['namespace:7', 'facade:7']);
});

// While the rows of a loop are computed the names are read off their cells by
// another branch of their accessor, which read the cell as born: `None`, and a
// function not callable.
test('and a cleanup run while the rows of a loop are computed', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(EarlyRows, { target });
    flushSync();

    expect(rowEvents).toEqual(['run:7h', 'clean:7h']);
});

// A store's getter reads the name as Python does, through the namespace: read
// off its derived, a deleted one ran a body it no longer had.
test("a store's deleted derived reads as nothing, and bound again as its value", async () => {
    const { store } = await import('./fixtures/deleted_derived_store.svelte.py');
    const read = [store.value];
    store.drop();
    read.push(store.value);
    store.rebind();
    read.push(store.value);

    expect(read).toEqual([14, undefined, 5]);
});
