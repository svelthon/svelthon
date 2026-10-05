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
import './fixtures/ClosingPrefixElement.svelte';

// The body ended at the first `</script` in the file, so a string or a comment
// beginning like the closing tag cut the props' source short: the element
// still observed `start`, read back off the exports, but not as the `int` it
// declares, and `start + 1` on the string raised.
test('a string beginning like the closing tag leaves the props their types', async () => {
    const element = document.createElement('closing-prefix-element');
    element.setAttribute('start', '5');
    document.body.appendChild(element);
    await Promise.resolve();
    flushSync();

    try {
        expect(element.querySelector('.closing-prefix').textContent).toBe('6|int');
        expect(typeof element.start).toBe('number');
    } finally {
        element.remove();
    }
});

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
