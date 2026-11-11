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
import ClassLazy from './fixtures/ClassLazy.svelte';
import { __pybridge } from '../src/lib/bridge.js';

// Telling a JavaScript object from one of the engine's reads `ob_type` without
// running a getter of that name, which is the author's and which Svelte never
// reads.
test('an object of classes whose ob_type is a getter is read without running it', () => {
    const classes = Object.defineProperty({ active: true }, 'ob_type', {
        enumerable: false,
        get() {
            throw new Error('ob_type getter executed');
        }
    });

    expect(__pybridge.klass(classes)).toBe(classes);
});

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

// A lazy iterable was the one value at a door that was neither listed nor
// refused: `class="<generator object <genexpr>>"`, `class="dict_keys([...])"`.
test('a lazy iterable gives the classes the list list() makes of it gives', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(ClassLazy, { target });
    flushSync();

    expect(['list', 'generator', 'keys'].map((k) => target.querySelector(`[data-k="${k}"]`).getAttribute('class'))).toEqual([
        'on wide',
        'on wide',
        'on wide'
    ]);
});
