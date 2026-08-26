import { test, expect, describe, beforeEach } from 'vitest';
import { mount, flushSync } from 'svelte';

import Revision from './fixtures/Revision.svelte';

// A spike kept around: can an in-place mutation propagate through a separate
// revision signal, rather than by reassigning a copy the way publish() did? The
// answer decides how publish() gets replaced, and these tests pin down its
// limits so they need not be rediscovered.

let target;
const el = (k) => target.querySelector(`[data-k="${k}"]`);
const rows = (k) => el(k).children.length;

beforeEach(() => {
    target = document.body.appendChild(document.createElement('div'));
    mount(Revision, { target });
    flushSync();
});

describe('propagation through a revision counter', () => {
    test('an {#each} sees the mutation', () => {
        expect(rows('each')).toBe(2);
        el('mutate').click();
        flushSync();
        expect(rows('each')).toBe(3);
    });

    test('an interpolation sees it', () => {
        el('mutate').click();
        flushSync();
        expect(el('len').textContent).toBe('3');
    });

    test('a $derived that computes sees it', () => {
        expect(el('total').textContent).toBe('3');
        el('mutate').click();
        flushSync();
        expect(el('total').textContent).toBe('6'); // 1 + 2 + 3
    });

    // Where the revision counter stops, and it is not a defect: a $derived
    // memoises on `===`, so one that returns the mutated object itself has the
    // same value as before and propagates nothing. That is Svelte's documented
    // behaviour, asserted here as it stands rather than wished away.
    //
    // Svelthon does not try to undo the memoisation. It goes around it: the
    // object subscribes its own reader through follow(), at the other end of the
    // chain — see 'a @derived returning the mutated object propagates too' in
    // tests/fidelity.test.js.
    test('a $derived returning the same object does not, on its own', () => {
        expect(rows('derived')).toBe(2);
        el('mutate').click();
        flushSync();
        expect(rows('derived')).toBe(2);
    });

    test('control: without the counter, nothing moves', () => {
        el('silently').click();
        flushSync();
        expect(rows('each')).toBe(2);
    });
});
