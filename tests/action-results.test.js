import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import ActionResults from './fixtures/ActionResults.svelte';
import ActionUpdates from './fixtures/ActionUpdates.svelte';
import ActionTypes from './fixtures/ActionTypes.svelte';

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
