// @vitest-environment node
//
// The server half of `shadowed-array.test.js`: an array holding a method's name
// or a constructor of its own as data renders on a server as Svelte renders it.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import ShadowedArray from './fixtures/ShadowedArray.svelte';
import ShadowedArrayNative from './fixtures/ShadowedArrayNative.svelte';

test.for(['null', 'answering', 'raising', 'constructor', 'species', 'throwing species'])(
    'an array holding %s as data renders on a server as Svelte renders it',
    (kind) => {
        expect(render(ShadowedArray, { props: { kind } }).body).toBe(render(ShadowedArrayNative, { props: { kind } }).body);
    }
);
