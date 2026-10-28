// **A function of a JavaScript namespace is called as JavaScript calls a
// member**: `readAttr` adapted it alone, called on nothing, so the template's
// `{actions.who()}` and `use:actions.stamp` read no `this` where the script's
// `actions.who()` read the namespace; and a bundled namespace, an ordinary
// object a production build gives the tag `Module`, was taken for an object,
// its handler bound to it where Svelte hands the element.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { readAttr } from '../src/lib/bridge.js';
import NamespaceReceiver from './fixtures/NamespaceReceiver.svelte';

test('a function of a namespace reads the namespace called alone, and the element as a handler', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(NamespaceReceiver, { target });
    flushSync();

    target.querySelector('[data-k="handler"]').click();
    flushSync();

    const read = (key) => target.querySelector(`[data-k="${key}"]`);

    expect([
        read('dot').textContent,
        read('getattr').textContent,
        read('script').textContent,
        read('action').dataset.stamp,
        read('handler').dataset.receiver
    ]).toEqual(['actions', 'actions', 'actions', 'actions:3.5', 'BUTTON']);
});

// The namespace a bundler builds for a module it inlines: an ordinary object,
// its exports as getters, the tag nothing can write. Read as any object's, its
// function was bound to it, and a handler was called on the namespace.
test('a function of a bundled namespace is called as one of a module', () => {
    const bundled = {};

    Object.defineProperty(bundled, 'label', { get: () => 'bundled', enumerable: true });
    Object.defineProperty(bundled, 'who', {
        get: () =>
            function () {
                return this?.label ?? 'no receiver';
            },
        enumerable: true
    });
    Object.defineProperty(bundled, Symbol.toStringTag, { value: 'Module' });

    const who = readAttr(bundled, 'who');

    expect([who(), who.call({ label: 'element' })]).toEqual(['bundled', 'element']);
});
