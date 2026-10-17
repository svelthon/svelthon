// **A Python function a JavaScript module hands on is that function again.** An
// import from JavaScript adapted every function as JavaScript's, a Python one
// a module re-exports among them: its `1.0` crossed as the number 1 and came
// back an int, a `Price(float)` a plain float with its `currency` gone, and the
// function was another object. The same function imported from Python is the
// witness, and CPython's answers with it; a function of JavaScript's own is
// still adapted, `echo(0.5)` handed a float back.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as consumer from './fixtures/relayed_consumer.py';
import RelayedCalls from './fixtures/RelayedCalls.svelte';

test('a Python function a JavaScript module hands on is that function to a Python module', () => {
    const direct = [...consumer.direct()];

    expect(direct).toEqual([true, 'float:1.0', 'Price', 'Label', true, 'EUR']);
    expect([...consumer.named()]).toEqual(direct);
    expect([...consumer.held()]).toEqual(direct);
    expect(consumer.javascript()).toBe('float');
});

test('and to a template, by name and through the namespace', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(RelayedCalls, { target });
    flushSync();

    const shown = (key) => target.querySelector(`[data-k="${key}"]`).textContent;

    expect(shown('python')).toBe('float:1.0|Price:0.5');
    expect([shown('named'), shown('namespace')]).toEqual([shown('python'), shown('python')]);
});
