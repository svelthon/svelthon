// **An option whose value comes from a spread is selected as one whose value is
// written by name**, as in Svelte. The spread handed the option the Python value
// itself while the binding compared JavaScript's: an option holding the model's
// plain `0.5` showed unselected, and so did a NaN and an instance of a
// subclass, in a single select as in a multiple one.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import OptionSpread from './fixtures/OptionSpread.svelte';
import OptionSpreadNative from './fixtures/OptionSpreadNative.svelte';

const KINDS = ['float', 'int', 'str', 'nan', 'price', 'count', 'label'];

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [false, true].flatMap((many) => KINDS.map((kind) => [language, many ? 'multiple' : 'single', kind, many]))
    )
)('%s: a %s select over a spread %s option shows it selected', ([language, , kind, many]) => {
    const Component = language === 'Python' ? OptionSpread : OptionSpreadNative;
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target, props: { kind, many } });
    flushSync();

    expect(target.querySelector('option').selected).toBe(true);
});
