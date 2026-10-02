// A field bound to `model.value` writes through the dot, and the dot decides
// between an attribute and a key. It decided by reading the attribute, which ran
// the property's getter before its setter: a getter that counts saw a read the
// assignment never makes, and one that refuses a read kept the setter from being
// reached at all. Svelte's own binding calls the setter alone, and so does a
// Python assignment.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import WriteSetter from './fixtures/WriteSetter.svelte';
import WriteSetterNative from './fixtures/WriteSetterNative.svelte';

const typed = (Component, block) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });

    flushSync();
    instance.reset(block);

    const field = target.querySelector('input');

    field.value = 'after';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    const written = Array.from(instance.written());

    flushSync();

    return written;
};

test.each([
    ['Python', WriteSetter],
    ['native Svelte', WriteSetterNative]
])('%s: a typed value reaches the setter with no read before it', (_, Component) => {
    expect(typed(Component, false)).toEqual(['after', 0]);
});

test.each([
    ['Python', WriteSetter],
    ['native Svelte', WriteSetterNative]
])('%s: and a getter that refuses a read does not stop the write', (_, Component) => {
    expect(typed(Component, true)).toEqual(['after', 0]);
});

// The destination is still the one a read finds: an attribute held in the
// instance's own dictionary wins over a key of the same name.
test('a mapping with an attribute of a key\'s name is written where it is read', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(WriteSetter, { target });
    flushSync();

    const field = target.querySelector('[data-k="row"]');

    field.value = 'typed';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(target.querySelector('p').textContent).toBe('typed|key');
});
