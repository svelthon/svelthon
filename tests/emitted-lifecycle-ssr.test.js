// @vitest-environment node
//
// The server half of the hooks of `emitted-lifecycle.test.js`: a server never
// mounts, and runs `on_destroy` when a render closes, as Svelte's `onDestroy`.
// A hook imported, handed as a prop or imported by the module script did not.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import HooksImported from './fixtures/HooksImported.svelte';
import HooksMixed from './fixtures/HooksMixed.svelte';
import HooksDerived from './fixtures/HooksDerived.svelte';
import HooksProps from './fixtures/HooksProps.svelte';
import HooksModule from './fixtures/HooksModule.svelte';
import HooksNative from './fixtures/HooksNative.svelte';
import HooksKeyed from './fixtures/HooksKeyed.svelte';
import HooksComputedKey from './fixtures/HooksComputedKey.svelte';
import HooksFunctionGlobals from './fixtures/HooksFunctionGlobals.svelte';
import HooksModuleVars from './fixtures/HooksModuleVars.svelte';
import HooksModuleLocals from './fixtures/HooksModuleLocals.svelte';
import HooksBuiltinsGlobals from './fixtures/HooksBuiltinsGlobals.svelte';
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
    ['imported by the module script', HooksModule, {}],
    ['held by a derived', HooksDerived, {}],
    ['bound at its key of globals()', HooksKeyed, {}],
    ['bound at a key computed', HooksComputedKey, {}],
    ['bound through a function’s __globals__', HooksFunctionGlobals, {}],
    ['bound through vars()', HooksModuleVars, {}],
    ['bound through locals()', HooksModuleLocals, {}],
    ['bound through builtins.globals()', HooksBuiltinsGlobals, {}]
])('a hook %s runs on a server as Svelte’s does', ([, Component, props]) => {
    expect(run(HooksNative, {})).toEqual(['destroy']);
    expect(run(Component, props)).toEqual(run(HooksNative, {}));
});
