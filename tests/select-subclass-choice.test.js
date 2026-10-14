// **An option whose value is an instance of a subclass is its number, as
// everything handed to Svelte is**, a `Price(0.5)` the `0.5` a JavaScript child
// would get. The select compares what crossed, so it shows and writes back what
// Svelte does with two options of the same number: the first one that matches,
// and the plain value, its class left on the Python side.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SelectSubclassChoice from './fixtures/SelectSubclassChoice.svelte';
import SelectSubclassChoiceNative from './fixtures/SelectSubclassChoiceNative.svelte';

const choose = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();

    const select = target.querySelector('select');
    const shown = () => [...select.options].map((one) => one.selected);
    const before = shown();

    [...select.options].forEach((one, at) => (one.selected = at === 0));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    return { before, after: shown(), instance };
};

test.for(
    [false, true].flatMap((many) =>
        [
            ['price', 'float'],
            ['count', 'int'],
            ['label', 'str']
        ].map(([kind, type]) => [many ? 'multiple' : 'single', kind, many, type])
    )
)('a %s select over a %s option shows and writes back what Svelte does with its number', ([, kind, many, type]) => {
    const props = { kind, many };
    const native = choose(SelectSubclassChoiceNative, props);
    const python = choose(SelectSubclassChoice, props);

    expect([python.before, python.after]).toEqual([native.before, native.after]);
    expect(python.instance.chosen()).toBe(type);
});
