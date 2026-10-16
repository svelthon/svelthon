// **A name the program never bound is unbound, whatever JavaScript calls it.**
// A namespace inherits the accessors of its bindings, from an object that
// inherited in turn from `Object.prototype`: `constructor`, `toString`,
// `hasOwnProperty` and `valueOf` read as JavaScript's functions where Python
// raises `NameError`, at the top of a module and in its
// functions, and a class never declared took the same answer from the storage
// of the classes. A component, a module and a reactive module, each read at its
// top and in a function; `bound` is bound, and found. `python3` on the module.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InheritedNames from './fixtures/InheritedNames.svelte';
import * as plain from './fixtures/inherited_names.py';
import * as reactive from './fixtures/inherited_names_store.svelte.py';

const found = (list) => Array.from(list);

test('a name every JavaScript object has is unbound until the program binds it', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(InheritedNames, { target });
    flushSync();

    // A reactive module hands its state over through its store.
    expect({
        component: target.querySelector('output').textContent,
        module: [found(plain.at_top), found(plain.inside())],
        reactive: [found(reactive.store.at_top), found(reactive.inside())]
    }).toEqual({
        component: 'bound|bound',
        module: [['bound'], ['bound']],
        reactive: [['bound'], ['bound']]
    });
});
