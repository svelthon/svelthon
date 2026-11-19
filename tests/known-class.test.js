// A class written as a string, or as a choice between strings, which Svelte
// reads for the selectors it may take: through its adapter, it was a call that
// may be any class, and a selector no element could take went unwarned.
import { test, expect } from 'vitest';
import { preprocess, compile } from 'svelte/compiler';
import { mount, flushSync } from './mounted.js';
import { python } from '../src/lib/svelthon.js';
import KnownClass from './fixtures/KnownClass.svelte';
import KnownClassNative from './fixtures/KnownClassNative.svelte';

const style = '<style>.active { color: red; } .other { color: blue; } .unused { color: green; }</style>';
const unused = (made) =>
    made.warnings
        .filter((one) => one.code === 'css_unused_selector')
        .map((one) => one.message.match(/"([^"]+)"/)?.[1])
        .sort();

test.for([
    ['a string', '<p class={"active"}>x</p>', "<p class={'active'}>x</p>"],
    ['a choice', '<p class={"active" if on else "other"}>x</p>', "<p class={on ? 'active' : 'other'}>x</p>"],
    ['a choice in a choice', '<p class={"active" if on else ("other" if off else "")}>x</p>', "<p class={on ? 'active' : off ? 'other' : ''}>x</p>"],
    ['a string among text', '<p class="x {"active"}">x</p>', "<p class=\"x {'active'}\">x</p>"],
    ['a name, which may be any', '<p class={name}>x</p>', '<p class={name}>x</p>']
])('Svelte warns of the selectors a class written as %s cannot take, as of its own', async ([, py, js]) => {
    const pySource = `<script lang="python">\non = True\noff = False\nname = "active"\n</script>\n${py}\n${style}`;
    const jsSource = `<script>\nlet on = true;\nlet off = false;\nlet name = 'active';\n</script>\n${js}\n${style}`;
    const code = (await preprocess(pySource, [python()], { filename: 'Classes.svelte' })).code;

    expect(unused(compile(code, { filename: 'Classes.svelte' }))).toEqual(unused(compile(jsSource, { filename: 'Classes.svelte' })));
});

test('and renders the class it reads, as the state it tests changes', () => {
    const shown = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        const classes = () => ['literal', 'choice', 'nested', 'quoted'].map((k) => target.querySelector(`[data-k="${k}"]`).className);

        mount(Component, { target });
        flushSync();
        const before = classes();

        target.querySelector('[data-k="flip"]').click();
        flushSync();

        return [before, classes()];
    };

    expect(shown(KnownClass)).toEqual(shown(KnownClassNative));
    expect(shown(KnownClass)[1]).toEqual(['active', 'other', 'other', 'x other']);
});
