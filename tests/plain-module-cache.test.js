// An ordinary module has no signals, as a JavaScript module has none: a cache
// its functions fill while the page renders is its own, and the page follows
// nothing it keeps. Held by the name `import plain_cache` binds, the module was
// watched with all it held, the cache among them, and its write while the page
// rendered was refused as a write to a `$state` is, `state_unsafe_mutation`:
// the page did not mount.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PlainModuleCache from './fixtures/PlainModuleCache.svelte';
import PlainModuleCacheNative from './fixtures/PlainModuleCacheNative.svelte';

// What the page shows once mounted, then after each button.
const shown = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const view = () => target.querySelector('[data-k="view"]').textContent;
    const seen = [];

    mount(Component, { target });
    flushSync();
    seen.push(view());

    for (const k of ['go', 'forget']) {
        target.querySelector(`[data-k="${k}"]`).click();
        flushSync();
        seen.push(view());
    }

    return seen;
};

test('a component keeps an ordinary module out of the page, its cache filled while rendering, as Svelte does a JavaScript one', () => {
    expect(shown(PlainModuleCache)).toEqual(shown(PlainModuleCacheNative));
});
