// A container a block declares, `{rows = [1]}`, changed in place: the change
// was made, and the page kept the old value, where the same container declared
// by the script repainted, and so did Svelte's own `{let rows = $state([1])}`.
// The block's value is followed as the script's is.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import BlockState from './fixtures/BlockState.svelte';

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
