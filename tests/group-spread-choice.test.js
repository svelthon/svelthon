// **A group's control whose value comes from a spread is the value it is given**,
// as one written `value={…}` is: a NaN, or an instance of a subclass the model
// holds, shows checked, and unticked then ticked again it is written back as
// itself. The spread made it the JavaScript scalar a select compares, and the
// group, which reads it as Python does, got another value back.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupSpreadChoice from './fixtures/GroupSpreadChoice.svelte';
import GroupSpreadChoiceNative from './fixtures/GroupSpreadChoiceNative.svelte';

test.for(
    ['Python', 'Svelte'].flatMap((language) => ['nan', 'price', 'count', 'label'].map((kind) => [language, kind]))
)('%s: a %s from a spread shows checked and is written back as itself', ([language, kind]) => {
    const Component = language === 'Python' ? GroupSpreadChoice : GroupSpreadChoiceNative;
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind } });
    flushSync();

    const input = target.querySelector('input');
    const tick = (checked) => {
        input.checked = checked;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        flushSync();

        return [...instance.held(), input.checked];
    };

    expect(input.checked).toBe(true);
    expect(tick(false)).toEqual([0, false, false]);
    expect(tick(true)).toEqual([1, true, true]);
});
