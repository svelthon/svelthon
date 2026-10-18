// A container a block declares, `{rows = [1]}`, changed in place: the change
// was made, and the page kept the old value, where the same container declared
// by the script repainted, and so did Svelte's own `{let rows = $state([1])}`.
// The block's value is followed as the script's is.
import { test, expect } from 'vitest';
import { mount as mountSvelte, unmount } from 'svelte';
import { mount, flushSync } from './mounted.js';
import { __pybridge, marks, track } from '../src/lib/bridge.js';
import BlockState from './fixtures/BlockState.svelte';
import BlockLease from './fixtures/BlockLease.svelte';
import BlockReplace from './fixtures/BlockReplace.svelte';

// A list a child put in the block's name through a binding, and then left there
// when it went: the block follows it as it follows what it declared. It was
// followed only through the child's own names, and once the child was gone a
// change to it repainted nothing.
test('a container a binding writes in a block is followed after its writer goes', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(BlockReplace, { target });
    flushSync();

    const click = async (key) => {
        target.querySelector(`button[data-k="${key}"]`).click();
        flushSync();
        await Promise.resolve();
        flushSync();
    };
    const shown = () => target.querySelector('output').textContent;

    expect(shown()).toBe('0');

    await click('replace');
    expect(shown()).toBe('1');

    await click('hide');
    await click('append');
    expect(shown()).toBe('2');
});

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(BlockState, { target });
    flushSync();

    const at = (key) => target.querySelector(`output[data-k="${key}"]`);
    const click = (key) => {
        target.querySelector(`button[data-k="${key}"]`).click();
        flushSync();
    };
    const type = (text) => {
        const input = target.querySelector('input[data-k="name"]');
        input.value = text;
        input.dispatchEvent(new Event('input'));
        flushSync();
    };
    const shown = () => ['name', 'rows', 'table', 'nested'].map((key) => at(key).textContent);

    return { click, type, shown };
};

test('a container a block declares repaints when it changes inside', () => {
    const { click, type, shown } = setup();

    type('after');
    click('append');
    click('update');
    click('nested');
    expect(shown()).toEqual(['after', '2', '2', '2']);

    // Destroyed and made again, the block declares new containers, followed
    // as the first ones were.
    click('toggle');
    click('toggle');
    expect(shown()).toEqual(['before', '1', '1', '1']);

    click('append');
    expect(shown()).toEqual(['before', '2', '1', '1']);
});

// A list the parent shares, declared by a block made and destroyed over and
// over: the block signs one callback onto the list while it reads it, and
// signs it off when it goes, as the script's own names do. Each block signed
// one and kept it, after the component was gone too. One subscriber, signed
// first, is the list's own and stays.
test('a block signs off the list it declared when it goes', async () => {
    const settle = async () => {
        flushSync();
        await Promise.resolve();
        flushSync();
    };
    const shared = __pybridge.list([1]);
    track(shared, () => {});
    const counted = () => marks(shared).bumps.length;

    const target = document.body.appendChild(document.createElement('div'));
    let instance;
    flushSync(() => {
        instance = mountSvelte(BlockLease, { target, props: { shared } });
    });
    await settle();

    const counts = [counted()];
    for (let i = 0; i < 3; i++) {
        instance.toggle();
        await settle();
        counts.push(counted());
        instance.toggle();
        await settle();
        counts.push(counted());
    }

    await unmount(instance);
    await settle();
    counts.push(counted());
    target.remove();

    expect(counts).toEqual([2, 1, 2, 1, 2, 1, 2, 1]);
});
