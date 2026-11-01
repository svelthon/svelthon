// **A name that shadows a snippet of the markup is no snippet of the markup**:
// a snippet's parameter or an `{#each}` alias spelled as one of its snippets
// holds whatever it was handed, a JavaScript parent's snippet among them, and
// `{@render}` hands that one its arguments as JavaScript's, `1.5` a number.
// Told by its spelling, it was taken for the markup's own and handed a Python
// float, an object to JavaScript. Svelte's own component shows the same.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ShadowedSnippetRoot from './fixtures/ShadowedSnippetRoot.svelte';

test.for(['parameter', 'alias'])('a snippet handed under a %s spelled as one of the markup takes JavaScript values', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(ShadowedSnippetRoot, { target, props: { kind } });
    flushSync();

    expect(target.querySelector('output').textContent).toBe('number:1.5');
});
