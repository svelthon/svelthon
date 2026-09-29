// Svelte compares a key with `===`. A list, a dict, a set or an instance is the
// same object while it lives, so it keys by identity, as it does in JavaScript;
// only a value rebuilt on every computation (a tuple, a float) keys by repr(),
// which `tests/keys.test.js` holds.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import KeyIdentity from './fixtures/KeyIdentity.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(KeyIdentity, { target });
    flushSync();
    return {
        at: (key) => target.querySelector(`[data-k="${key}"]`),
        press: (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        }
    };
};

test('two equal rows keyed by themselves are two rows', () => {
    expect(setup().at('todos').textContent).toBe('todotodo');
});

// A key made from a repr() is not the string that spells it.
test('a value keyed by repr() and its spelling are two keys', () => {
    expect(setup().at('mixed').textContent).toBe('floatstrtuplestrbytesstr');
});

test('two NaN are two keys', () => {
    expect(setup().at('nans').textContent).toBe('nannan');
});

test('a list mutated keeps its {#key} block', () => {
    const { at, press } = setup();
    const before = at('block');
    press('grow');
    expect(at('block')).toBe(before);
    expect(at('block').textContent).toBe('2');
});

test('a list replaced by an equal one re-creates it', () => {
    const { at, press } = setup();
    const before = at('block');
    press('replace');
    expect(at('block')).not.toBe(before);
});

test('a field in a row keyed by itself survives a keystroke', () => {
    const { at } = setup();
    const field = at('field');
    field.value = 'Ada L';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(at('field')).toBe(field);
});
