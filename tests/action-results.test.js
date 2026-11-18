import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import ActionResults from './fixtures/ActionResults.svelte';
import ActionUpdates from './fixtures/ActionUpdates.svelte';
import ActionTypes from './fixtures/ActionTypes.svelte';
import ActionPayload from './fixtures/ActionPayload.svelte';
import ActionPayloadNative from './fixtures/ActionPayloadNative.svelte';
import ActionPayloadHost from './fixtures/ActionPayloadHost.svelte';
import ActionReadsHost from './fixtures/ActionReadsHost.svelte';
import ActionDictLive from './fixtures/ActionDictLive.svelte';
import ActionDictLiveNative from './fixtures/ActionDictLiveNative.svelte';
import ActionFirstUpdatePy from './fixtures/ActionFirstUpdatePy.svelte';
import ActionFirstUpdateJs from './fixtures/ActionFirstUpdateJs.svelte';
import { held } from './fixtures/action_resources.js';
import { calls } from './fixtures/action_log.js';

// The resources an action holds after each step: mounted, updated twice,
// unmounted.
const holding = (Component) => {
    held.clear();
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    const steps = [];

    flushSync();
    steps.push([...held]);
    for (let i = 0; i < 2; i++) {
        instance.bump();
        flushSync();
        steps.push([...held]);
    }
    unmount(instance);
    target.remove();
    steps.push([...held]);

    return steps;
};

// A dict an action returns is read as Svelte reads its own result, each member
// when it is called: an `update` that puts a new `destroy` in it is heard at
// teardown. Copied as the action returned it, the first `destroy` was called,
// and the resource taken since stayed held.
test('the dict an action returns is read when Svelte calls it', () => {
    const steps = holding(ActionDictLive);

    expect(steps).toEqual([['resource 0'], ['resource 1'], ['resource 2'], []]);
    expect(steps).toEqual(holding(ActionDictLiveNative));
});

// The events a JavaScript parent's action records, handed to a child, along
// the steps the parent is taken through.
const recorded = (Host, Child, steps) => {
    const events = [];
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(Host, { target, props: { Child, events } });

    for (const [step, ...args] of steps) {
        flushSync();
        host[step](...args);
    }
    flushSync();
    unmount(host);

    return events;
};

// A JavaScript action's result is read where Svelte reads it, in the effect
// that installs the action: an `update` a state turns on installs the action
// again and is then called, and `destroy` is read as often. Read as the action
// returned, untracked, the `update` turned on was never heard of.
test('the getters of an action’s result are read as Svelte reads them', () => {
    const steps = [['enable'], ['bump'], ['disable'], ['bump']];
    const native = recorded(ActionPayloadHost, ActionPayloadNative, steps);

    expect(recorded(ActionPayloadHost, ActionPayload, steps)).toEqual(native);
    expect(native.filter(([kind]) => kind === 'update')).toEqual([['update', 2, 1.5]]);
});

// And its `update` runs as Svelte runs it, in that effect: a state it reads
// beside the value updates it again when it changes alone, where untracked the
// page kept what the action had written.
test('a state a JavaScript action’s update reads updates it again, as in Svelte', () => {
    const steps = [['rename', 'B'], ['bump'], ['rename', 'C'], ['bump'], ['rename', 'D']];
    const native = recorded(ActionReadsHost, ActionPayloadNative, steps);

    expect(recorded(ActionReadsHost, ActionPayload, steps)).toEqual(native);
    expect(native).toContainEqual(['update', '1.5:C']);
});

// Svelte reads an action's `update` and `destroy` off whatever it answers, a
// callable included. A Python callable was adapted as a deferred transition's
// is, into a function that held neither, so a function carrying both, or an
// instance with `__call__`, was installed and then never updated nor destroyed.
//
// A dict that is callable too was read as an instance, by attribute: its
// `update` was `dict.update`, called with the new value, and its `destroy` was
// none. A dict's are its entries, callable or not, and an empty one has none.
//
// And an instance of a class deriving from a list, a str, an int or a float
// was taken for the list or the scalar, copied without its methods.
test.for(['dict', 'instance', 'function', 'callable instance', 'callable dict', 'list subclass', 'str subclass', 'int subclass', 'float subclass'])(
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

test('an action answering with an empty callable dict is neither updated nor destroyed', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ActionResults, { target, props: { shape: 'empty callable dict' } });

    flushSync();
    instance.change();
    flushSync();
    unmount(instance);

    expect(instance.model()).toBe('install:1');
});

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

// Svelte updates an action at the first run that reads its value again, the
// value the same or not, its first comparison being against nothing; so does a
// Python component, where that run was skipped and an action measuring its node
// missed it.
test('an action is updated at the first run of its value, as Svelte updates it', () => {
    const run = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));

        calls.length = 0;
        mount(Component, { target });
        flushSync();

        for (let click = 0; click < 3; click++) {
            target.querySelector('button').click();
            flushSync();
        }

        return [...calls];
    };
    const svelte = run(ActionFirstUpdateJs);

    expect([run(ActionFirstUpdatePy), svelte]).toEqual([svelte, ['mount:0', 'update:0', 'update:1']]);
});

// And by the number a float or an int stands for, so `1` then `1.0`, or `0.0`
// then `-0.0`, never reached it, though the page showed each. The witness is
// the model, which notes each write that changes what Python shows.
test('a Python action is updated when its value changes type or sign', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ActionTypes, { target });

    flushSync();
    for (const text of ['1', '1.0', '1.0', '1', '2', '0.0', '-0.0', '-0.0', '0']) {
        instance.write(text);
        flushSync();
    }

    const [log, expected] = Array.from(instance.model(), (one) => Array.from(one));

    expect(log).toEqual(expected);
    expect(expected).toEqual(['int:1', 'float:1.0', 'int:1', 'int:2', 'float:0.0', 'float:-0.0', 'int:0']);
});
