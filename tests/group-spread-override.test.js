// **A spread that follows `value` gives the box its value, even when it reads
// the same as the one it replaces**, as in Svelte. The group took the value back
// from the JavaScript scalar Svelte applied, and a `Count(1)` replaced by a
// spread's `1` matched it: ticking the box wrote the replaced `Count`. Without
// the spread, the box writes the instance itself, its class with it.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupSpreadOverride from './fixtures/GroupSpreadOverride.svelte';
import GroupSpreadOverrideNative from './fixtures/GroupSpreadOverrideNative.svelte';

const tick = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();

    const input = target.querySelector('input');

    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();

    return instance.written();
};

test.for(
    ['checkbox', 'radio'].flatMap((control) =>
        [
            ['count', 'int', 'Count'],
            ['label', 'str', 'Label']
        ].flatMap(([kind, plain, subclass]) =>
            [true, false].map((spread) => [control, kind, spread, spread ? plain : subclass])
        )
    )
)('a %s of a %s, spread %s, writes what Svelte does: %s', ([control, kind, spread, type]) => {
    const props = { control, kind, spread };
    const [native] = tick(GroupSpreadOverrideNative, props);

    expect(tick(GroupSpreadOverride, props)).toEqual([native, type]);
    expect(native).toBe(!spread);
});
