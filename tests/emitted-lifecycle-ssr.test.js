// @vitest-environment node
//
// The server half of the hooks of `emitted-lifecycle.test.js`: a server never
// mounts, and runs `on_destroy` when a render closes, as Svelte's `onDestroy`.
// A hook imported, handed as a prop or imported by the module script did not.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import HooksImported from './fixtures/HooksImported.svelte';
import HooksMixed from './fixtures/HooksMixed.svelte';
import HooksProps from './fixtures/HooksProps.svelte';
import HooksModule from './fixtures/HooksModule.svelte';
import HooksNative from './fixtures/HooksNative.svelte';
import { on_mount, on_destroy } from './fixtures/lifecycle_hooks.js';
import { events } from './fixtures/lifecycle_log.js';

const run = (Component, props) => {
    events.length = 0;
    void render(Component, { props }).body;

    return [...events];
};

test.for([
    ['imported', HooksImported, {}],
    ['one bound by =, one imported', HooksMixed, {}],
    ['handed as props', HooksProps, { on_mount, on_destroy }],
    ['imported by the module script', HooksModule, {}]
])('a hook %s runs on a server as Svelte’s does', ([, Component, props]) => {
    expect(run(HooksNative, {})).toEqual(['destroy']);
    expect(run(Component, props)).toEqual(run(HooksNative, {}));
});
