// An object of conditional classes from a JavaScript parent, `{active: true,
// inactive: false}`, is what Svelte reads as one: the class is `active`. It
// was not a Python dict, so it fell through to the text of the object, and the
// element carried the class `<Javascript object: [object Object]>`, directly,
// through a spread, and inside a list. Against the same component in
// JavaScript.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import ClassMap from './fixtures/ClassMap.svelte';
import ClassMapNative from './fixtures/ClassMapNative.svelte';

const classesOf = async (Component, classes) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { classes } });

    try {
        flushSync();
        return ['direct', 'spread'].map((key) => target.querySelector(`[data-k="${key}"]`).getAttribute('class'));
    } finally {
        await unmount(instance);
        target.remove();
    }
};

test.for([
    ['an object', () => ({ active: true, inactive: false })],
    ['an object without a prototype', () => Object.assign(Object.create(null), { active: true, inactive: false })],
    ['an object in a list', () => ['base', { active: true, inactive: false }]],
    ['a string', () => 'base active'],
    ['a list', () => ['base', 'active']]
])('%s gives the classes Svelte gives', async ([, made]) => {
    const native = await classesOf(ClassMapNative, made());

    expect(native[0]).toContain('active');
    expect(await classesOf(ClassMap, made())).toEqual(native);
});
