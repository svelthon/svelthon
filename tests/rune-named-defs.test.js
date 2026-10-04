// A `def` named like one of Svelte's runes, `state` or `props`. Its wrapper
// was a JavaScript `const` of the same name, and Svelte reads `$state` as a
// subscription to a store once the script binds `state` to an ordinary value:
// every `$state.raw` cell of the component read that store before it was
// declared, and the component failed to mount with `Cannot access 'state'
// before initialization`. `def props()` did the same to `$props()`. The
// witness is the same component in Svelte, which has to name its functions
// otherwise and exports one under the rune's name.
import { test, expect } from 'vitest';
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
// the store object and as named exports, and both read the renamed wrapper:
// reading the bare name, the module failed to import with `state is not
// defined`.
test('a store whose functions are named state and props imports and answers', async () => {
    const module = await import('./fixtures/rune_named.svelte.py');

    expect([module.state(), module.props(), module.answer()]).toEqual([42, 1, 7]);
    expect([module.default.state(), module.default.props()]).toEqual([42, 1]);
});

test('a def named state or props mounts, renders and exports, as in Svelte', () => {
    expect(mounted(RuneNamedDefs)).toEqual(mounted(RuneNamedDefsNative));
    expect(mounted(RuneNamedDefs, { label: 'cells' })).toEqual(mounted(RuneNamedDefsNative, { label: 'cells' }));
});
