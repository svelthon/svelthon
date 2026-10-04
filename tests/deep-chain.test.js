// A structure as deep as a loop makes it, under watch. The walk that takes a
// value in hand was a recursion three frames deep per object, and the climb
// that carries a change back to the names one frame per link, so a linked list
// of two thousand nodes held by a name failed at mount with `Maximum call stack
// size exceeded`, and appending one to a watched list failed in the handler.
// Python walks the same chain without a limit, and so does Svelte's deep state.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DeepChain from './fixtures/DeepChain.svelte';
import DeepChainNative from './fixtures/DeepChainNative.svelte';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const read = () =>
        Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));
    const click = (name) => {
        target.querySelector(`.${name}`).click();
        flushSync();
    };

    return { read, click };
};

describe('a linked list of twenty thousand nodes', () => {
    test('mounts under watch and repaints from its tail, as in Svelte', () => {
        const ours = mounted(DeepChain);
        const theirs = mounted(DeepChainNative);

        expect(ours.read()).toEqual(theirs.read());

        ours.click('bump');
        theirs.click('bump');

        expect(ours.read().chain).toBe('20000:1');
        expect(ours.read()).toEqual(theirs.read());
    });

    test('and goes into a watched list from a handler', () => {
        const ours = mounted(DeepChain);
        const theirs = mounted(DeepChainNative);

        ours.click('hold');
        theirs.click('hold');

        expect(ours.read().held).toBe('1:20000');
        expect(ours.read()).toEqual(theirs.read());
    });
});
