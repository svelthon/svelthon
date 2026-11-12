// @vitest-environment node
//
// The server half of `unquoted-values.test.js`: a box whose title is `checked`
// is rendered checked by its group, where the title was taken for the author's
// own `checked` and the group's left out. And a value spelled as a directive,
// `title=bind:checked`, is text, as Svelte keeps it: a binding was written into
// it, which Svelte then refused, and `title=let:item` was refused as a slot.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import { preprocess, compile } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';
import UnquotedWords from './fixtures/UnquotedWords.svelte';
import UnquotedWordsNative from './fixtures/UnquotedWordsNative.svelte';

test.for([
    ['Python', UnquotedWords],
    ['Svelte', UnquotedWordsNative]
])('%s: a box titled checked is rendered checked by its group, on a server', ([, Component]) => {
    const { body } = render(Component, { props: { held: [] } });

    expect(/<input[^>]*\schecked=""/.test(body)).toBe(true);
});

test.for(['title=bind:checked', 'title = class:active', 'title=style:color', 'title=let:item'])(
    'a value spelled as a directive is kept as text: <input %s>',
    async (attribute) => {
        const markup = `<input ${attribute}>`;
        const { code } = await preprocess(`<script lang="python">\nx = 1\n</script>\n${markup}`, python(), {
            filename: 'src/Probe.svelte'
        });

        expect(code.includes(markup)).toBe(true);
        expect(() => compile(code, { filename: 'src/Probe.svelte', generate: 'server' })).not.toThrow();
    }
);
