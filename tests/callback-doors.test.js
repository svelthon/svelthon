// **A callback JavaScript built is called with JavaScript numbers, whichever
// door it entered Python by.** A module's function adapted it, and so did a
// context and a snippet's parameter; a prop, an argument to a component's
// function and one to a store's kept the raw function, which Brython then
// handed its own float, and `value.toFixed` raised.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CallbackDoors from './fixtures/CallbackDoors.svelte';
import CallbackDoorsNative from './fixtures/CallbackDoorsNative.svelte';
import { apply_value } from './fixtures/callback_doors.py';
import { store } from './fixtures/callback_store_door.svelte.py';

const callback = (value) => `${typeof value}:${value.toFixed(2)}`;

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { callback } });

    flushSync();

    return instance;
};

test.for([
    ['a module function', () => apply_value(callback)],
    ['a store function', () => store.apply_value(callback)],
    ['a component function', () => mounted(CallbackDoors).apply_value(callback)],
    ['a component prop', () => mounted(CallbackDoors).use_prop()],
    ['a Svelte component function, the witness', () => mounted(CallbackDoorsNative).apply_value(callback)],
    ['a Svelte component prop, the witness', () => mounted(CallbackDoorsNative).use_prop()]
])('%s hands a JavaScript callback a number', ([, run]) => {
    expect(run()).toBe('number:0.25');
});
