// @vitest-environment node
//
// An attribute Svelte reads as boolean is read for Python's truth, and the
// names are Svelte's: the table was written by hand and left out
// `indeterminate`, `webkitdirectory`, `disablepictureinpicture` and
// `disableremoteplayback`, so an empty list reached Svelte as JavaScript's true
// and switched each on, in the page and in the server's HTML.
//
// Svelte's list is `DOM_BOOLEAN_ATTRIBUTES` in its `src/utils.js`, which no
// public path exports, so it is read here from the installed source, and the
// table has to equal it. The witness of the rendering is Svelte given the
// truth Python finds.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { render } from 'svelte/server';

import { BOOLEAN_ATTRIBUTES } from '../src/lib/attributes.js';
import BooleanNames from './fixtures/BooleanNames.svelte';
import BooleanNamesNative from './fixtures/BooleanNamesNative.svelte';

const svelte = dirname(createRequire(import.meta.url).resolve('svelte/package.json'));
const utils = readFileSync(join(svelte, 'src', 'utils.js'), 'utf8');
const listed = utils.match(/const DOM_BOOLEAN_ATTRIBUTES = \[([^\]]*)\]/)[1];

test('the boolean attributes are Svelte’s', () => {
    expect(BOOLEAN_ATTRIBUTES).toEqual([...listed.matchAll(/'([^']+)'/g)].map(([, name]) => name));
});

test.for([[false], [true]])('the server writes them as Svelte does, on: %s', ([on]) => {
    expect(render(BooleanNames, { props: { on } }).body).toBe(render(BooleanNamesNative, { props: { on } }).body);
});
