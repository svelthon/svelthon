import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InstanceData from './fixtures/InstanceData.svelte';
import InstanceDataNative from './fixtures/InstanceDataNative.svelte';

// What an `@export` hands back is the instance's data, and a JavaScript parent
// reads it as it reads a Svelte component's `$state`: an object with its keys
// and nothing of the engine's, spread and serialised as such, and live, so a
// change the component makes afterwards is there in what the parent holds.
const read = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    flushSync();

    const conf = instance.config();
    const rows = instance.items();
    const seen = [
        JSON.stringify(conf),
        Object.getOwnPropertySymbols(conf).length,
        JSON.stringify({ ...conf }),
        Array.isArray(rows),
        JSON.stringify(rows)
    ];

    instance.bump();
    flushSync();

    return [...seen, JSON.stringify(conf), JSON.stringify(rows)];
};

test('an exported dict and list read as a Svelte component hands its state', () => {
    expect(read(InstanceData)).toEqual(read(InstanceDataNative));
});

test('the Svelte component is the rule', () => {
    expect(read(InstanceDataNative)).toEqual([
        '{"count":0,"rate":0.5,"none":null}',
        0,
        '{"count":0,"rate":0.5,"none":null}',
        true,
        '[1,2]',
        '{"count":1,"rate":0.5,"none":null}',
        '[1,2,3]'
    ]);
});
