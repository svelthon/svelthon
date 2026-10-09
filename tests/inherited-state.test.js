// A class attribute written on the class that holds it repaints what reads it
// through an instance, a subclass, or an instance of that class. Only the
// class itself was watched: `Base.count += 1` moved the model to `1|0` and
// left the page at `0|0`. Appending to a list already read worked, the list
// being watched on its own, and an attribute of the instance's own masks the
// class's as in Python.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InheritedState from './fixtures/InheritedState.svelte';

test.for(
    ['instance', 'subclass', 'own class'].flatMap((kind) =>
        ['augmented', 'rebound', 'append', 'masked'].map((how) => [kind, how])
    )
)('read through %s, a write on the base, %s, repaints', ([kind, how]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(InheritedState, { target, props: { kind } });

    flushSync();
    instance.change(how);
    flushSync();

    const page = target.querySelector('p').textContent;

    expect(page).not.toBe('0|0');
    expect(page).toBe(instance.held());
});
