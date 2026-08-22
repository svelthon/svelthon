import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import PyDirectives from './fixtures/PyDirectives.svelte';

// Every directive except `bind:` now takes a Python value. `bind:` cannot: it
// wants an assignable reference, and a call has no setter — which also means the
// question of language barely arises there, since a reference is a name.
describe('a directive whose value is Python', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PyDirectives, { target });
        flushSync();

        return {
            at: (k) => target.querySelector(`[data-k="${k}"]`),
            press: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('class: follows Python truth, not JavaScript truth', () => {
        // An empty list is false in Python and true in JavaScript. Getting this
        // wrong is invisible: the class is simply always on.
        expect(setup().at('empty').classList.contains('many')).toBe(false);
    });

    test('class: takes a whole Python expression', () => {
        const { at, press } = setup();

        expect(at('counted').classList.contains('many')).toBe(false);
        press('add');
        press('add');
        press('add');
        expect(at('counted').classList.contains('many')).toBe(true);
    });

    test('class: on a plain name still works', () => {
        expect(setup().at('flagged').classList.contains('on')).toBe(true);
    });

    test('style: takes a conditional expression', () => {
        expect(setup().at('styled').style.color).toBe('red');
    });

    test('use: receives a Python dict as its options', () => {
        expect(setup().at('acted').dataset.mark).toBe('boot:1');
    });

    test('and its update() sees the dict change', () => {
        const { at, press } = setup();
        press('raise');
        expect(at('acted').dataset.mark).toBe('boot:2');
    });

    test('transition: takes its options as a Python dict', () => {
        // `{"y": 20, "duration": 1, "easing": linear}` where JavaScript wrote
        // `{y: 20, …}`. Svelte reads the keys off the dict directly.
        expect(setup().at('flown')).not.toBeNull();
    });
});
