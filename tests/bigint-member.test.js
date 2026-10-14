// **Adding a large int a set holds already writes nothing**, as a `SvelteSet`
// adding a `BigInt` it holds writes nothing, so a template may read through it.
// A large int is a JavaScript `bigint`, which the watch took for a value it
// could not tell about, and announced a change Svelte refused while rendering,
// `state_unsafe_mutation`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BigIntMember from './fixtures/BigIntMember.svelte';
import BigIntMemberNative from './fixtures/BigIntMemberNative.svelte';

test.for([
    ['Python', BigIntMember],
    ['Svelte', BigIntMemberNative]
])('%s: adding a large int a set holds while rendering shows it once', ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    expect(target.querySelector('output').textContent).toBe('1');
});
