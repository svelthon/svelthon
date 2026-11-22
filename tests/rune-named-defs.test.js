// A `def` named like one of Svelte's runes, `state` or `props`. Its wrapper
// was a JavaScript `const` of the same name, and Svelte reads `$state` as a
// subscription to a store once the script binds `state` to an ordinary value:
// every `$state.raw` cell of the component read that store before it was
// declared, and the component failed to mount with `Cannot access 'state'
// before initialization`. `def props()` did the same to `$props()`. The
// witness is the same component in Svelte, which has to name its functions
// otherwise and exports one under the rune's name.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { compile } from '../src/lib/compile.js';
import { mount, flushSync } from './mounted.js';
import RuneNamedDefs from './fixtures/RuneNamedDefs.svelte';
import RuneNamedDefsNative from './fixtures/RuneNamedDefsNative.svelte';

const mounted = (Component, props = {}) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();

    return { text: target.querySelector('p').textContent, exported: instance.state() };
};

// A shared `.svelte.py` exports its functions under their own names, through
// the store object and as named exports, and both read the function off the
// namespace: reading the bare name, the module failed to import with `state is
// not defined`. It makes no wrapper of them, which nothing would read.
test('a store whose functions are named state and props imports and answers', async () => {
    const module = await import('./fixtures/rune_named.svelte.py');
    const source = readFileSync(resolve(import.meta.dirname, 'fixtures/rune_named.svelte.py'), 'utf8');
    const { script: code } = compile(source, 'rune_named_svelte', 'tests/fixtures/rune_named.svelte.py', { store: true, sourceContent: source });

    expect([module.state(), module.props(), module.answer()]).toEqual([42, 1, 7]);
    expect([module.default.state(), module.default.props()]).toEqual([42, 1]);
    expect(code).not.toContain('__brycomp_pyComponent(');
});

test('a def named state or props mounts, renders and exports, as in Svelte', () => {
    expect(mounted(RuneNamedDefs)).toEqual(mounted(RuneNamedDefsNative));
    expect(mounted(RuneNamedDefs, { label: 'cells' })).toEqual(mounted(RuneNamedDefsNative, { label: 'cells' }));
});
