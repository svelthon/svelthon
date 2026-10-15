// **A page written in JavaScript alone follows the Python it reads.** Whether a
// read is a reaction's is Svelte's to say, `$effect.tracking()`, and the
// runtime asks it of the component or store whose script Svelte compiles,
// which hands the answer over as it loads: the runtime imports nothing of
// Svelte's internals. A page with neither has nobody to ask, and every read is
// taken for a reaction's, which costs a walk and subscribes nothing outside
// one. Taken for none, a JavaScript component kept showing a class attribute
// Python had changed.
//
// Alone in its file, so no Python component mounted elsewhere has answered.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ClassLabelReader from './fixtures/ClassLabelReader.svelte';

test('a JavaScript component repaints a class attribute Python changes', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(ClassLabelReader, { target });
    flushSync();
    expect(target.querySelector('p').textContent).toBe('first');

    target.querySelector('button').click();
    flushSync();
    expect(target.querySelector('p').textContent).toBe('second');
});
