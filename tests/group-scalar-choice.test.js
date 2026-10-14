// **A choice the model already holds shows checked, even when only itself is
// equal to it**, as Svelte's group compares the value the field was given. The
// group compared the JavaScript scalar the `value` attribute made for the DOM:
// a NaN became another NaN, and a `Price(0.5)` a plain float its own `==`
// refuses, so the box showed unchecked while the model held the choice. The
// plain float, int and str are the control.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupScalarChoice from './fixtures/GroupScalarChoice.svelte';
import GroupScalarChoiceNative from './fixtures/GroupScalarChoiceNative.svelte';

const KINDS = ['nan', 'price', 'count', 'label', 'float', 'int', 'str'];

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        ['checkbox', 'radio'].flatMap((control) => KINDS.map((kind) => [language, control, kind]))
    )
)('%s: a %s whose choice is %s, held by the model, shows checked', ([language, control, kind]) => {
    const Component = language === 'Python' ? GroupScalarChoice : GroupScalarChoiceNative;
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props: { kind, control } });
    flushSync();

    expect(target.querySelector('input').checked).toBe(true);
});
