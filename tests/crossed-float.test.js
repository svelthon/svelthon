import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import CrossedFloat from './fixtures/CrossedFloat.svelte';
import CrossedFloatNative from './fixtures/CrossedFloatNative.svelte';
import CrossedFloatHost from './fixtures/CrossedFloatHost.svelte';
import CrossedFloatPythonHost from './fixtures/CrossedFloatPythonHost.svelte';

const steps = (Host, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Host, { target, props });
    flushSync();

    const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent;
    const out = [read('parent')];

    for (const step of ['half', 'whole']) {
        instance[step]();
        flushSync();
        out.push(read('parent'));
    }

    return { out, child: read('child') };
};

// A float a Python child writes into a prop a JavaScript parent binds reaches
// that parent as a number, as a Svelte child's does.
test('a JavaScript parent gets a number, as from a Svelte child', () => {
    expect(steps(CrossedFloatHost, { Child: CrossedFloat }).out).toEqual(
        steps(CrossedFloatHost, { Child: CrossedFloatNative }).out
    );
});

test('the Svelte child is the rule', () => {
    expect(steps(CrossedFloatHost, { Child: CrossedFloatNative }).out).toEqual([
        'number:0.25',
        'number:0.50',
        'number:15.00'
    ]);
});

// The same write read by a Python parent, and by the child itself, is the float
// it was, as CPython has it: `15.0` and not `15`.
test('a Python parent and the child itself read the float written', () => {
    const { out, child } = steps(CrossedFloatPythonHost);

    expect(out).toEqual(['float:0.25', 'float:0.5', 'float:15.0']);
    expect(child).toBe('float:15.0');
});
