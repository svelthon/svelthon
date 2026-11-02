// **An action's value is read through only where Svelte reads it**: Svelte
// hands the value to the action untracked, and reads it through in the effect
// that calls `update`, which an action without one does not get. Svelthon read
// it through at each evaluation, the first one included: a getter of the value
// ran before the action did, which then wrote the second value it handed out,
// and ran without an action at all. The witness is the same child in Svelte.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ActionGetter from './fixtures/ActionGetter.svelte';
import ActionGetterNative from './fixtures/ActionGetterNative.svelte';
import ActionGetterHost from './fixtures/ActionGetterHost.svelte';

const run = (Child, mode) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(ActionGetterHost, { target, props: { Child, mode } });
    const seen = () => [target.querySelector('[data-k="action"]').dataset.token ?? null, host.counted()];

    flushSync();
    const first = seen();
    host.change();
    flushSync();

    return [first, seen()];
};

test.for([['update'], ['without update'], ['absent']])('an action %s reads the getters of its value as Svelte does', ([mode]) => {
    const native = run(ActionGetterNative, mode);

    expect(run(ActionGetter, mode)).toEqual(native);
    if (mode !== 'absent') expect(native[0][0]).toBe('1:1');
});
