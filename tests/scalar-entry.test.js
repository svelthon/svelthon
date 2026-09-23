// A scalar JavaScript hands to the template is made Python where it enters: a
// fractional number becomes a float, so `round()` works on it, and an absence
// becomes None. The rule `pyBind` keeps at a binding, at the two other doors:
// a prop, and the value a JavaScript promise resolves to in `{#await}`.
import { test, expect, describe } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import ScalarProps from './fixtures/ScalarProps.svelte';
import ScalarPropsParent from './fixtures/ScalarPropsParent.svelte';
import ScalarAwait from './fixtures/ScalarAwait.svelte';

const setup = (Component, props = {}) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target, props });
    flushSync();
    return (key) => target.querySelector(`[data-k="${key}"]`);
};

describe('a fractional prop', () => {
    test.for(['amount', 'two-way'])('is a Python float: %s', (key) => {
        expect(setup(ScalarProps, { amount: 0.42, two_way: 0.42 })(key).textContent).toBe('0.4');
    });

    test.for(['amount', 'two-way'])('and stays one when the parent updates it: %s', (key) => {
        const at = setup(ScalarPropsParent);
        document.querySelector('button').click();
        flushSync();
        expect(at(key).textContent).toBe('0.8');
    });

    test('and an absent one is None', () => {
        expect(setup(ScalarProps, { amount: null })('absent').textContent).toBe('True');
    });
});

describe('a value a JavaScript promise resolves to', () => {
    test.for([
        ['a fractional number is a float', 'js-float', '0.4'],
        ['null is None', 'js-none', 'True'],
        ['control: a Python coroutine s float', 'py-float', '0.4']
    ])('%s', async ([, key, answer]) => {
        const at = setup(ScalarAwait);
        await settled(() => expect(at(key)).not.toBeNull());
        expect(at(key).textContent).toBe(answer);
    });
});
