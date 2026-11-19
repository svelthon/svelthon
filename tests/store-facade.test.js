// A store's keys are the names its module holds now (`storeFacade`), as Python's
// `hasattr` answers: frozen or sealed it keeps JavaScript's own rules, and a
// page that asks whether a name is there follows the module.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { store as frozen } from './fixtures/facade_frozen_store.svelte.py';
import { store as sealed } from './fixtures/facade_sealed_store.svelte.py';
import { store as classes } from './fixtures/facade_class_store.svelte.py';
import { store as closed } from './fixtures/facade_closed_store.svelte.py';
import { store as inherited } from './fixtures/facade_inherited_store.svelte.py';
import FacadeClassPresence from './fixtures/FacadeClassPresence.svelte';

// Frozen with a name only annotated, which the store leaves out: JavaScript
// refused the freeze, and every listing of the keys after it. And closed to new
// keys, the name only annotated appeared.
test('a store frozen or closed keeps the keys it had, and lists them', () => {
    expect(() => Object.freeze(frozen)).not.toThrow();
    expect([Object.isFrozen(frozen), Object.keys(frozen), frozen.count]).toEqual([true, ['count'], 3]);

    Reflect.preventExtensions(closed);

    expect([Object.keys(closed), Object.hasOwn(closed, 'note')]).toEqual([['count'], false]);
});

// Names JavaScript's objects inherit, `constructor` and `toString`, which the
// module holds only once it binds them: they were keys of the store throughout.
test('a store lists a name its prototype has only while its module holds it', () => {
    const listed = () => ['constructor', 'toString', 'note'].filter((name) => Object.keys(inherited).includes(name));
    const first = listed();

    inherited.bind();

    const bound = listed();

    inherited.unbind();

    expect([first, bound, listed()]).toEqual([[], ['constructor', 'toString'], []]);
});

// Sealed, then a name deleted by Python: listing the keys, or asking for one,
// threw, as a sealed object may not lose one.
test('a store sealed answers for a name its module deleted since', () => {
    Object.seal(sealed);
    sealed.remove();

    expect(() => [Object.keys(sealed), 'count' in sealed]).not.toThrow();
});

// A class the module removes, through `globals()` or by `del`, which no signal
// holds: the page asking whether it is there kept saying it was.
test('the page follows a class the store removes and puts back', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const view = () => {
        flushSync();
        return target.querySelector('[data-k="view"]').textContent;
    };

    mount(FacadeClassPresence, { target });

    const first = view();

    classes.remove_profile();

    const removed = view();

    classes.restore_profile();

    const restored = view();

    classes.remove_other();

    expect([first, removed, restored, view()]).toEqual(['true|true|true|true', 'false|false|false|true', 'true|true|true|true', 'true|true|true|false']);
});
