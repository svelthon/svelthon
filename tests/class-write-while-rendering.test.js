// **A class attribute written while the template renders is refused, as Svelte
// refuses a write to its state there.** A paragraph read `Box.label` and the
// next one's expression wrote it: the write was kept quiet while rendering, so
// the page showed `a` beside `b` while the model held `b`, with no error. The
// readers are woken now, and Svelte refuses the write (`state_unsafe_mutation`)
// read through the class, a subclass or an instance, as it refuses it for its
// own `$state` field.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ClassWriteWhileRendering from './fixtures/ClassWriteWhileRendering.svelte';
import ClassWriteWhileRenderingNative from './fixtures/ClassWriteWhileRenderingNative.svelte';

test.for([
    ['Python', 'class', ClassWriteWhileRendering],
    ['Python', 'subclass', ClassWriteWhileRendering],
    ['Python', 'instance', ClassWriteWhileRendering],
    ['Svelte', 'field', ClassWriteWhileRenderingNative]
])('%s: a write while rendering to what a painted reader shows is refused, read through the %s', ([, reader, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));

    expect(() => {
        mount(Component, { target, props: { reader } });
        flushSync();
    }).toThrow(/state_unsafe_mutation/);
});
