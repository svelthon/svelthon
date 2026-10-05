// A spread on an element reads each property of the object once, as a
// JavaScript spread does. The copy read every getter, and the attributes that
// take a wrapper, a handler, `class`, a boolean, `hidden`, read it a second
// time: a getter that answers otherwise the second time disabled a button,
// changed its class, dropped its handler, and one that refuses stopped the
// mount. Against the same component in JavaScript.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import SpreadGetters from './fixtures/SpreadGetters.svelte';
import SpreadGettersNative from './fixtures/SpreadGettersNative.svelte';

// Mounts the component with one getter that answers `values` read after read,
// clicks the button, and says what it saw.
const run = async (Component, key, values) => {
    let reads = 0;
    let clicks = 0;
    const attrs = Object.defineProperty({}, key, {
        enumerable: true,
        get() {
            const value = values[Math.min(reads++, values.length - 1)];
            if (value === 'refuse') throw new Error('read twice');
            return value === 'handler' ? () => (clicks += 1) : value;
        }
    });
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { attrs } });

    try {
        flushSync();
        const button = target.querySelector('button');
        button.click();
        flushSync();

        return {
            reads,
            clicks,
            disabled: button.disabled,
            class: button.getAttribute('class'),
            hidden: button.getAttribute('hidden'),
            title: button.getAttribute('title')
        };
    } finally {
        await unmount(instance);
        target.remove();
    }
};

test.for([
    ['disabled', [false, true]],
    ['class', ['first', 'second']],
    ['hidden', [false, true]],
    ['onclick', ['handler', undefined]],
    ['disabled', [false, 'refuse']],
    ['title', ['first', 'second']]
])('a getter of %s is read once, as by Svelte', async ([key, values]) => {
    const native = await run(SpreadGettersNative, key, values);

    expect(native.reads).toBe(1);
    expect(await run(SpreadGetters, key, values)).toEqual(native);
});
