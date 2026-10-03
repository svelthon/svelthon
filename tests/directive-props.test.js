// A directive whose head is a JavaScript function a parent handed in as a prop.
// Svelte calls it with the value Python holds, so it is given JavaScript's
// values, at installation as at every update, as the same function is given
// them by a component written in Svelte.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import PropAction from './fixtures/PropAction.svelte';
import PropActionNative from './fixtures/PropActionNative.svelte';
import KeptAction from './fixtures/KeptAction.svelte';

// What a JavaScript function sees of the value it is given.
const seen = (value) => {
    if (typeof value === 'number') return ['number', value];
    if (value !== null && typeof value === 'object' && 'weight' in value) return ['weight', typeof value.weight, value.weight];
    if (value !== null && typeof value === 'object' && 'run' in value) {
        return ['run', typeof value.run, typeof value.run === 'function' ? value.run() : null];
    }
    return ['other', typeof value];
};

const run = (component, props, steps, act) => {
    const calls = [];
    const target = document.body.appendChild(document.createElement('div'));
    const fade = (node, params) => {
        calls.push(['fade', ...seen(params)]);
        return { duration: 0 };
    };
    const instance = mount(component, { target, props: { ...props, act: act(calls), fade } });

    flushSync();

    for (const step of steps) {
        instance[step]();
        flushSync();
    }

    unmount(instance);

    return calls;
};

// An action that answers with an object, and one that answers with a function
// carrying the two methods: Svelte reads them off either.
const answering = (shape) => (calls) => (node, value) => {
    calls.push(['install', ...seen(value)]);

    const update = (next) => calls.push(['update', ...seen(next)]);
    const destroy = () => calls.push(['destroy']);

    if (shape === 'object') return { update, destroy };

    return Object.assign(() => {}, { update, destroy });
};

test.for([
    ['a number', 'scalar', 'object'],
    ['a record', 'record', 'object'],
    ['a record holding a bound method', 'callback', 'object'],
    ['a number, to an action answering with a function', 'scalar', 'function']
])('an action handed in as a prop is given %s as a Svelte component gives it', ([, shape, answer]) => {
    const steps = ['change'];
    const native = run(PropActionNative, { shape }, steps, answering(answer));
    const python = run(PropAction, { shape }, steps, answering(answer));

    expect(native.map((one) => one[0])).toEqual(['install', 'update', 'destroy']);
    expect(python).toEqual(native);
});

test('a transition handed in as a prop is given its value as a Svelte component gives it', () => {
    const native = run(PropActionNative, {}, ['show'], answering('object'));
    const python = run(PropAction, {}, ['show'], answering('object'));

    expect(native).toContainEqual(['fade', 'number', 0.25]);
    expect(python).toEqual(native);
});

// An action imported in the module script converts its own argument: handed it
// converted already, it would make a copy of the copy, and the object handed
// back would no longer be the dict.
test('an imported action is given its argument converted once', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(KeptAction, { target });

    flushSync();

    expect(instance.same()).toBe(true);
});
