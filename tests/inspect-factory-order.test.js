// The browser half of `inspect-factory-order-ssr.test.js`, which differs: Svelte
// reads the values, then the logger at each log, and so does `inspect_with`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InspectFactoryOrder from './fixtures/InspectFactoryOrder.svelte';
import InspectFactoryOrderNative from './fixtures/InspectFactoryOrderNative.svelte';

test('a browser reads the logger of inspect_with at each log, as Svelte does', () => {
    const order = (Component) => {
        globalThis.__order = [];
        mount(Component, { target: document.body.appendChild(document.createElement('div')) });
        flushSync();

        return globalThis.__order;
    };
    const native = order(InspectFactoryOrderNative);

    expect(native).toEqual(['value', 'logger', 'logged', 'value']);
    expect(order(InspectFactoryOrder)).toEqual(native);
});
