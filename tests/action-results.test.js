import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import ActionResults from './fixtures/ActionResults.svelte';

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
