// A `>` inside a quoted value of the `<script>` tag. The tag was read up to the
// first `>`, quotes or not: with the value ahead of `lang="python"` the markup
// pass saw no Python and left the template JavaScript's, so `{#if rows}` read an
// empty list as true, while the script pass, handed Svelte's own reading of the
// attributes, compiled it as Python. With `lang` first, the body was taken to
// start inside the value, and an error was reported a line short.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import QuotedHeader from './fixtures/QuotedHeader.svelte';
import QuotedHeaderLines from './fixtures/QuotedHeaderLines.svelte';
import './fixtures/QuotedHeaderElement.svelte';

// The written-out `customElement={{…}}` is read by Svelte's parser over the file
// with the script's body blanked, and the body was taken to start inside the
// quoted value: the value never closed, and the component did not compile.
test('an element declared by the object form observes its props', () => {
    expect(customElements.get('quoted-header-element').observedAttributes).toEqual(['start']);
});

test('the template is Python whatever the tag quotes before `lang`', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(QuotedHeader, { target });

    try {
        flushSync();
        expect(target.textContent.trim()).toBe('no');
    } finally {
        await unmount(instance);
        target.remove();
    }
});

test('an error is reported at its line under a tag over two lines', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(QuotedHeaderLines, { target });

    try {
        flushSync();
        expect(() => instance.fail()).toThrow('QuotedHeaderLines.svelte:6');
    } finally {
        await unmount(instance);
        target.remove();
    }
});
