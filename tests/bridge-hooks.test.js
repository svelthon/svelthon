// @vitest-environment node
//
// **The three questions the runtime asks of Svelte are laid down once, in a
// component's `<script module>`**: laid down by each instance, they were
// functions of its scope, which the runtime keeps in global slots, and the last
// instance's props stayed alive once it was unmounted (a megabyte held in
// Chromium after fifty mounts, the last one's). A store is a module and keeps
// them where its body is.
import { test, expect } from 'vitest';
import { preprocess } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';
import { compile } from '../src/lib/compile.js';

const HOOKS = ['tracking(', 'refusing(', 'proxying('];

test("a component's hooks are its module script's, not its instance's", async () => {
    const { code } = await preprocess('<script lang="python">\npayload: object\n</script>\n<p>ready</p>\n', python(), {
        filename: '/tmp/Hooks.svelte'
    });
    const module = code.match(/<script module>([\s\S]*?)<\/script>/)[1];
    const instance = code.match(/<script(?![^>]*module)[^>]*>([\s\S]*?)<\/script>/)[1];

    expect([HOOKS.map((one) => module.includes(`__brycomp_svelthon_hooks.${one}`)), HOOKS.map((one) => instance.includes(`__brycomp_pybridge.${one}`))]).toEqual([
        [true, true, true],
        [false, false, false]
    ]);
});

test('and a store keeps them where its body is', () => {
    const { script } = compile('count = 0\n', 'Store', 'src/store.svelte.py', { store: true });

    expect(HOOKS.map((one) => script.includes(`__brycomp_pybridge.${one}`))).toEqual([true, true, true]);
});
