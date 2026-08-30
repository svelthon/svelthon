import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import Host from './fixtures/LeakHost.svelte';

// A container shared through a store carries one marker holding the bump and
// read signals of everyone who tracked it. Mounting appends to it; unmounting
// does not remove anything, so the list keeps signals of components that are
// gone. Documented, not fixed: the fix is to hand each subscriber a way out,
// the way `createSubscriber` from `svelte/reactivity` does.
test('unmounting does not unsubscribe from a shared container', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Host, { target });
    flushSync();

    const cycle = () => {
        for (const _ of [0, 1]) {
            target.querySelector('button').click();
            flushSync();
        }

        return ['alive', 'subscribed']
            .map((k) => target.querySelector(`[data-k="${k}"]`).textContent)
            .join('/');
    };

    expect([cycle(), cycle(), cycle(), cycle()]).toEqual(['1/2', '1/3', '1/4', '1/5']);
});
