// **An array's items are read by index into a plain array, never by a method or
// a constructor it holds as data**, as Svelte reads them. A multiple select bound
// to `[1]` whose `map` was `null` failed to mount, `value.map is not a function`,
// one whose `map` answered `[2]` showed the second option, and a `class` read off
// an array whose `filter` was data failed the same way. Then the standard
// methods that replaced them asked the array's `constructor` for the species of
// their copy: `null` failed to mount, and a typed species made the selection a
// `Uint8Array`, which Svelte refused.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ShadowedArray from './fixtures/ShadowedArray.svelte';
import ShadowedArrayNative from './fixtures/ShadowedArrayNative.svelte';

const KINDS =['null', 'answering', 'raising', 'constructor', 'species', 'throwing species'];

test.for(['Python', 'Svelte'].flatMap((language) => KINDS.map((kind) => [language, kind])))(
    '%s: an array holding %s as data is read as its items',
    ([language, kind]) => {
        const Component = language === 'Python' ? ShadowedArray : ShadowedArrayNative;
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target, props: { kind } });
        flushSync();

        expect([...target.querySelectorAll('option')].map((one) => one.selected)).toEqual([true, false]);
        expect(target.querySelector('p').className).toBe('picked');
    }
);
