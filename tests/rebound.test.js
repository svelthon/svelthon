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

// The same rule for a list an attribute held: `Shelf.rows = [1]`, `box.rows =
// [1]` or `del box.rows`, then the old list changed, re-ran the effect reading
// the new one, the old list's link to the attribute kept as long as it lived.
// So did a slot, and a list an instance read off its class, the class given a
// new one. The runs are counted, since the page reads right either way.
const HOLDERS = ['class', 'instance', 'inherited', 'list subclass', 'dict subclass', 'slot', 'function', 'module name'];

test.for(HOLDERS.flatMap((kind) => [[kind, 'replace'], [kind, 'delete']]))(
    '%s: its attribute %sd lets the old list go',
    ([kind, mode]) => {
        const target = document.body.appendChild(document.createElement('div'));
        const runs = [];
        const instance = mount(ReboundAttribute, { target, props: { kind, mode, runs } });

        flushSync();
        for (const step of ['detach', 'change_old', 'change_current']) {
            instance[step]();
            flushSync();
        }

        expect(runs).toEqual(mode === 'replace' ? [0, 1, 2] : [0, 2, 3]);
    }
);

// A name only the author's code answers, a `__getattr__`, a property or a
// `__getattribute__`, is not read again to tell: the link stays, and a change
// of the list is seen. Even with a value of that name in the storage Python
// reads after the property, the class's for a metaclass's.
test.for(['getattr', 'property', 'shadowed property', 'metaclass property', 'getattribute'])('a list a %s hands out stays followed', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const runs = [];
    const instance = mount(ReboundAttribute, { target, props: { kind, runs } });

    flushSync();
    instance.change_current();
    flushSync();

    expect(runs).toEqual([0, 1]);
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
