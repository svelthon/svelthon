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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from 'svelte/server';

import { BOOLEAN_ATTRIBUTES, attributeWrapper } from '../src/lib/attributes.js';
import BooleanNames from './fixtures/BooleanNames.svelte';
import BooleanNamesNative from './fixtures/BooleanNamesNative.svelte';

const svelte = dirname(fileURLToPath(import.meta.resolve('svelte/package.json')));
const utils = readFileSync(join(svelte, 'src', 'utils.js'), 'utf8');
const listed = utils.match(/const DOM_BOOLEAN_ATTRIBUTES = \[([^\]]*)\]/)[1];
const names = (list) => [...list.matchAll(/'([^']+)'/g)].map(([, name]) => name);

test('the boolean attributes are Svelte’s', () => {
    expect(BOOLEAN_ATTRIBUTES).toEqual(names(listed));
});

// And each property Svelte sets that is a truth, `defaultChecked` among them,
// which no attribute spells and the table left to JavaScript's truth: every
// name of its `DOM_PROPERTIES` but the four that are values.
test('the boolean properties Svelte sets are read for truth', () => {
    const properties = names(utils.match(/const DOM_PROPERTIES = \[([^\]]*)\]/)[1]);
    const values = ['value', 'volume', 'defaultValue', 'srcObject'];

    expect(properties.filter((name) => !values.includes(name) && attributeWrapper(name) !== '__truthy')).toEqual([]);
});

test.for([[false], [true]])('the server writes them as Svelte does, on: %s', ([on]) => {
    expect(render(BooleanNames, { props: { on } }).body).toBe(render(BooleanNamesNative, { props: { on } }).body);
});
