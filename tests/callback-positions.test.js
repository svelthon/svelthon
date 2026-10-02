// **One Python callback is one JavaScript function, wherever it crosses.** Two
// families of sites published two wrappers — `pyHandler` for a library call and
// an export, a second layer around it for a config — and a prop got the first,
// so `direct === config.cb` was false and a registry could not remove one
// through the other. A callback prop named `on…` took a third road, the DOM
// handler's, and its answer reached the child unconverted.
//
// And an attachment is one function per callable, since Svelte reinstalls the
// attachment the moment the function its expression gives is a new one.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CallbackPositions from './fixtures/CallbackPositions.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(CallbackPositions, { target });
    flushSync();

    return { instance, at: (k) => target.querySelector(`[data-k="${k}"]`) };
};

test('is one function as a prop, inside a config, in a spread, as an on… prop and through a library', () => {
    const { at } = setup();

    expect(at('same').textContent).toBe('true');
    expect(at('removed').textContent).toBe('true');
});

test('and an on… callback prop answers the child with a JavaScript value', () => {
    expect(setup().at('answer').textContent).toBe('number:0.25');
});

test('and still writes the parent, as a handler does', () => {
    const { at } = setup();

    at('change').click();
    flushSync();

    expect(at('count').textContent).toBe('7');
});

test('an attachment whose expression re-runs on the same function is kept', () => {
    const { at } = setup();
    const node = at('attached');

    at('flip').click();
    flushSync();

    expect(node.dataset.installs).toBe('1');
    expect(node.dataset.cleanups).toBeUndefined();
});
