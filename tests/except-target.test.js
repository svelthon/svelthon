// **The name of an `except … as` is unbound when its handler ends**, as CPython
// unbinds it, `name = None` then `del name`: in the markup it reads as a
// deleted name reads, absent, and in Python it is a `NameError`. Read in the
// markup it raised `NameError`, the one form of binding that did not follow the
// rule; over a name bound before it, the value stayed, to the page and to
// Python. And `global` puts it in the module, where its handler sees it, and
// takes it out again.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ExceptTarget from './fixtures/ExceptTarget.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ExceptTarget, { target });
    flushSync();

    return { instance, text: (k) => target.querySelector(`[data-k="${k}"]`).textContent };
};

test('after its handler, the markup reads it as absent and Python as unbound', () => {
    const { instance, text } = setup();

    expect([text('caught'), text('held')]).toEqual(['[]', '[]']);
    expect(instance.reads()).toEqual(['NameError', 'NameError', 'NameError']);
});

test('a global name is bound in its handler, and unbound after it', () => {
    const { instance, text } = setup();

    expect(instance.handle()).toEqual(['later', false]);
    flushSync();
    expect([text('later'), instance.reads()[2]]).toEqual(['[]', 'NameError']);
});
