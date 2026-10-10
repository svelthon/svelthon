// A name rebound to another value no longer reads the one it held. Its
// subscription to the old value goes, so mutating that value does not re-run an
// effect that reads the name; another name still holding it keeps its own.
import { test, expect, beforeEach } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Rebound from './fixtures/Rebound.svelte';
import ReboundAttribute from './fixtures/ReboundAttribute.svelte';
import { events, oldEvents } from './fixtures/rebound_log.js';

beforeEach(() => {
    events.length = 0;
    oldEvents.length = 0;
});

// The same rule for a list an attribute held: `Shelf.rows = [1]` or `box.rows =
// [1]`, then the old list changed, re-ran the effect reading the new one, the
// old list's link to the attribute kept as long as it lived. The runs are
// counted, since the page reads right either way.
test.for(['class', 'instance', 'list subclass', 'function', 'module name'])('an attribute replaced lets its old list go: %s', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const runs = [];
    const instance = mount(ReboundAttribute, { target, props: { kind, runs } });

    flushSync();
    for (const step of ['replace', 'change_old', 'change_current']) {
        instance[step]();
        flushSync();
    }

    expect(runs).toEqual([0, 1, 2]);
});

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Rebound, { target });
    flushSync();
    return (key) => {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
    };
};

test('mutating the old value re-runs only what still reads it', () => {
    const press = setup();
    press('replace');
    press('old');

    expect(events).toEqual([0, 1]);
    expect(oldEvents).toEqual([0, 1]);
});

test('control: mutating the new value re-runs the effect', () => {
    const press = setup();
    press('replace');
    press('current');

    expect(events).toEqual([0, 1, 2]);
});
