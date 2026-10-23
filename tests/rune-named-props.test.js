// A bindable prop named like one of Svelte's runes, `state` or `props`. Its
// variable was the prop's name, and Svelte reads `$state` as a subscription to
// a store once the script binds `state`: the component failed to mount with
// `Cannot access 'state' before initialization`. A custom element's props are
// bindables, so `state: int = 1` did the same there. The witness is the same
// component in Svelte, which names its variables otherwise.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import RuneNamedProps from './fixtures/RuneNamedProps.svelte';
import RuneNamedPropsNative from './fixtures/RuneNamedPropsNative.svelte';
import RuneNamedPropsHost from './fixtures/RuneNamedPropsHost.svelte';
import './fixtures/RuneNamedElement.svelte';

const read = (Child) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(RuneNamedPropsHost, { target, props: { Child } });
    const shown = () => [target.querySelector('output').textContent, target.querySelector('p').textContent];
    flushSync();

    const seen = [shown()];
    host.step();
    flushSync();

    return [...seen, shown()];
};

test('bindable props named like runes mount, render and write up, as in Svelte', () => {
    const native = read(RuneNamedPropsNative);

    expect(native).toEqual([
        ['5|2|7', '5'],
        ['6|2|7', '6']
    ]);
    expect(read(RuneNamedProps)).toEqual(native);
});

test('a custom element prop named state reads its attribute', async () => {
    const element = document.createElement('rune-named-element');
    element.setAttribute('state', '5');
    document.body.appendChild(element);
    await Promise.resolve();
    flushSync();

    try {
        expect([element.state, element.querySelector('output').textContent]).toEqual([5, '5']);
    } finally {
        element.remove();
    }
});
