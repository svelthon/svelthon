// A link from a child to its container lasts as long as it leads somewhere.
// A container nobody listens to any more, the list of a component that is
// gone, is a dead end, and a mutation of the shared data it held drops the
// link as it passes. A container listened to again takes its children back.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import { marks } from '../src/lib/bridge.js';
import SharedRowHolder from './fixtures/SharedRowHolder.svelte';
import Reattached from './fixtures/Reattached.svelte';
import shared from './fixtures/shared_row.svelte.py';

test('a thousand mounts leave no link on shared data once it changes', () => {
    const target = document.body.appendChild(document.createElement('div'));

    for (let i = 0; i < 1000; i++) {
        const one = mount(SharedRowHolder, { target });
        flushSync();
        unmount(one);
    }

    shared.bump();
    flushSync();

    expect(marks(shared.shared).parents?.length ?? 0).toBe(0);
});

test('a container put back after its links were dropped follows its children again', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Reattached, { target });
    flushSync();

    const press = (key) => {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
    };

    press('detach');
    press('touch');
    press('reattach');
    press('grow');

    expect(target.querySelector('p').textContent).toBe('[[[1, 2]]]');
});

test('and so does one a name takes up', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Reattached, { target });
    flushSync();

    const press = (key) => {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
    };

    press('detach');
    press('touch');
    press('name');
    press('grow');

    expect(target.querySelector('i').textContent).toBe('[[1, 2]]');
});
