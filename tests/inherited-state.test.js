// A class attribute written on the class that holds it repaints what reads it
// through an instance, a subclass, or an instance of that class, and so does
// one a class between creates, shadowing it, replaces or deletes. Only the
// class itself was watched: `Base.count += 1` moved the model to `1|0` and left
// the page at `0|0`; then only the class holding it, and `Middle.count = 9`
// left it at `0|0` again. Appending to a list already read worked, the list
// being watched on its own, and an attribute of the instance's own masks the
// class's as in Python.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InheritedState from './fixtures/InheritedState.svelte';

const shown = (kind, steps) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(InheritedState, { target, props: { kind } });
    const pages = [];

    flushSync();
    for (const how of steps) {
        instance.change(how);
        flushSync();
        pages.push([target.querySelector('p').textContent, instance.held()]);
    }

    return pages;
};

test.for(
    ['instance', 'subclass', 'own class'].flatMap((kind) =>
        ['augmented', 'rebound', 'append', 'masked'].map((how) => [kind, how])
    )
)('read through %s, a write on the base, %s, repaints', ([kind, how]) => {
    const [[page, model]] = shown(kind, [how]);

    expect(page).not.toBe('0|0');
    expect(page).toBe(model);
});

test.for(
    ['instance', 'subclass'].flatMap((kind) =>
        ['shadowed', 'shadowed rows', 'shadowed below'].map((how) => [kind, how])
    )
)('read through %s, a class between, %s, repaints', ([kind, how]) => {
    const [[page, model]] = shown(kind, [how]);

    expect(page).not.toBe('0|0');
    expect(page).toBe(model);
});

test.for(['instance', 'subclass'])('read through %s, a shadow made, replaced and deleted, repaints each time', (kind) => {
    expect(shown(kind, ['shadowed', 'shadowed', 'unshadowed'])).toEqual([
        ['9|0', '9|0'],
        ['9|0', '9|0'],
        ['0|0', '0|0']
    ]);
});
