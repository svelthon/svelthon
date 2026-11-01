// @vitest-environment node
//
// `$inspect(values).with(logger)` is `logger('init', ...values)` on a server: the
// logger is read first. `inspect_with` read it in a function taking the values,
// after them, so a factory's work was not yet there when the values were read.
import { test, expect } from 'vitest';
import { render } from 'svelte/server';
import InspectFactoryOrder from './fixtures/InspectFactoryOrder.svelte';
import InspectFactoryOrderNative from './fixtures/InspectFactoryOrderNative.svelte';

test('a server reads the logger of inspect_with before its values, as Svelte does', () => {
    const order = (Component) => {
        globalThis.__order = [];
        expect(render(Component).body).toContain('<p>0</p>');

        return globalThis.__order;
    };

    expect(order(InspectFactoryOrderNative)).toEqual(['logger', 'value', 'logged']);
    expect(order(InspectFactoryOrder)).toEqual(['logger', 'value', 'logged']);
});
