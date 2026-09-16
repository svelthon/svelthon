// Where an attribute's value lives, and how the watch reaches it.
//
// The initial walk reads an instance's own storage: its `__dict__` and its
// slots. Two shapes escape that, and both are ordinary Python.
//
// A **list subclass** is a JavaScript array *and* has an instance dict, and
// `ownAttributes` answered `undefined` for anything array-shaped, so `class
// Box(list)` with a `self.rows` lost its attribute — while its elements were
// walked as always.
//
// A **class attribute** is not on the instance at all. Nothing of the initial
// walk can see it without walking the class hierarchy, which would run getters
// and leave the author's data; what can see it is the read itself, which is
// where `$getitem` already hands the watch over for a subscript.
//
// The three fixtures differ by those two lines and nothing else, and the plain
// instance is the witness that repainted throughout.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InstanceAttr from './fixtures/InstanceAttr.svelte';
import ListSubclassAttr from './fixtures/ListSubclassAttr.svelte';
import ClassAttr from './fixtures/ClassAttr.svelte';

describe.for([
    ['an instance attribute', InstanceAttr],
    ['an attribute of a list subclass', ListSubclassAttr],
    ['an attribute held by the class', ClassAttr]
])('a list reached through %s', ([, Component]) => {
    test('repaints what reads it', () => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target });
        flushSync();

        const read = () => target.querySelector('[data-k="total"]').textContent;

        expect(read()).toBe('0');

        target.querySelector('button[data-k="go"]').click();
        flushSync();

        expect(read()).toBe('1');
    });
});
