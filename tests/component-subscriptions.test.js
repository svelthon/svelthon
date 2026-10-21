// What a component signs onto, it signs off when it goes, however it goes. A
// shared list read into a name of its own is followed for the component, and
// the component lets it go: one subscriber, signed first, is the list's own and
// stays.
import { test, expect } from 'vitest';
import { mount, unmount } from 'svelte';
import { flushSync } from './mounted.js';
import { __pybridge, marks, track } from '../src/lib/bridge.js';
import FailedConstructionHost from './fixtures/FailedConstructionHost.svelte';
import FailedScript from './fixtures/FailedScript.svelte';
import FailedTemplate from './fixtures/FailedTemplate.svelte';
import FailedEffect from './fixtures/FailedEffect.svelte';
import TeardownRebind from './fixtures/TeardownRebind.svelte';

const settle = async () => {
    flushSync();
    await Promise.resolve();
    flushSync();
};

const shared = () => {
    const list = __pybridge.list([1]);

    track(list, () => {});
    return { list, counted: () => marks(list).bumps.length };
};

// A construction that fails after reading the list, under a boundary that
// builds it again: each failed attempt kept its subscription, since the
// component's `onDestroy` is a deferred effect that never ran, and a retry
// added one more.
test.for([
    ['its script', FailedScript],
    ['its template', FailedTemplate],
    ['an effect', FailedEffect]
])('a construction that fails in %s after reading a shared list keeps no subscription to it', async ([, Child]) => {
    const { list, counted } = shared();
    const target = document.body.appendChild(document.createElement('div'));
    let host;

    flushSync(() => {
        host = mount(FailedConstructionHost, { target, props: { Child, shared: list } });
    });
    await settle();

    const counts = [counted()];
    for (let i = 0; i < 2; i++) {
        target.querySelector('[data-k="retry"]').click();
        await settle();
        counts.push(counted());
    }

    await unmount(host);
    await settle();
    counts.push(counted());
    target.remove();

    expect(counts).toEqual([1, 1, 1, 1]);
});

// A cleanup of the author's that rebinds a name to the list, after the
// component let it go: the write signed the component on again, for good, one
// more for each instance gone.
test('a cleanup that reads a shared list after the component let go signs nothing on', async () => {
    const { list, counted } = shared();
    const counts = [];

    for (let i = 0; i < 3; i++) {
        const target = document.body.appendChild(document.createElement('div'));
        let instance;

        flushSync(() => {
            instance = mount(TeardownRebind, { target, props: { shared: list } });
        });
        await settle();
        await unmount(instance);
        await settle();
        counts.push(counted());
        target.remove();
    }

    expect(counts).toEqual([1, 1, 1]);
});
