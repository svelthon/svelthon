import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import ActionResults from './fixtures/ActionResults.svelte';
import ActionUpdates from './fixtures/ActionUpdates.svelte';

// Svelte reads an action's `update` and `destroy` off whatever it answers, a
// callable included. A Python callable was adapted as a deferred transition's
// is, into a function that held neither, so a function carrying both, or an
// instance with `__call__`, was installed and then never updated nor destroyed.
test.for(['dict', 'instance', 'function', 'callable instance'])(
    'an action answering with a %s is updated and destroyed',
    (shape) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(ActionResults, { target, props: { shape } });

        flushSync();
        instance.change();
        flushSync();
        unmount(instance);

        expect(instance.model()).toBe('install:1,update:2,destroy:2');
    }
);

// A Python action was asked whether its value changed by the number a float's
// subclass stands for, so a new `Money(1.0)` in another currency never reached
// it; and its update, run in Svelte's effect, subscribed that effect to the log
// it appended to, which updated it again until Svelte gave up.
test.for(['float', 'int', 'str', 'object'])('a Python action is updated once by a new %s', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ActionUpdates, { target, props: { kind } });

    flushSync();
    instance.change();
    flushSync();

    expect(target.textContent.trim()).toBe('install:EUR,update:USD');
});
