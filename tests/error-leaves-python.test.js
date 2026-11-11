// What Python raises where Svelte alone calls it leaves Python there: a
// template expression, an effect, a derived Svelte recomputes. It left as the
// Brython object, which is no `Error`, and from a derived with neither message
// nor stack; and a runner that clones an uncaught error to send it from its
// worker walked from it the whole engine, `JavaScript heap out of memory`.
//
// It leaves as an ordinary `Error` holding nothing of Python, as a handler's
// does, and Python still catches its own exception: an `except` around a read
// of the derived, and a boundary written in Python.
import { test, expect, describe } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import RaiseOnUpdate from './fixtures/RaiseOnUpdate.svelte';
import RaiseAtExits from './fixtures/RaiseAtExits.svelte';

const setup = (where) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(RaiseOnUpdate, { target, props: { where } });
    flushSync();

    const click = (k) => {
        try {
            target.querySelector(`[data-k="${k}"]`).click();
            flushSync();
        } catch (error) {
            return error;
        }
    };

    return { click, read: (k) => target.querySelector(`[data-k="${k}"]`)?.textContent };
};

describe('what Python raises on an update', () => {
    test.for(['expression', 'derived', 'effect'])('leaves %s as an Error holding nothing of Python', (where) => {
        // Asked as booleans and text: a failure printed the Brython object.
        const error = setup(where).click('zero');

        expect(error instanceof Error).toBe(true);
        expect(String(error.message)).toMatch(/^ZeroDivisionError: division by zero \(/);
        expect(Object.getOwnPropertyNames(error).sort()).toEqual(['message', 'stack']);
    });

    test('and an except around a read of the derived takes its own exception', () => {
        const { click, read } = setup('nowhere');

        click('zero');
        click('guarded');

        expect(read('seen')).toBe('ZeroDivisionError');
    });

    test('and a boundary written in Python reads it as Python raised it', () => {
        const { click, read } = setup('boundary');

        click('zero');

        expect([read('failed'), read('failure')]).toEqual(['ZeroDivisionError', 'ZeroDivisionError']);
    });
});

// And where Svelte calls a lifecycle hook or an action, or JavaScript calls
// what Python published: it left as the Brython object, which a SvelteKit
// `handleError` read as ten kilobytes of engine and `JSON.stringify` refused.
describe('what Python raises where it is called from outside', () => {
    const plain = (error) => [error instanceof Error, Object.getOwnPropertyNames(error).sort(), String(error.message).split(' (')[0]];

    test.for([
        ['on_mount', 'ValueError: on_mount'],
        ['action', 'ValueError: action']
    ])('leaves %s as an Error holding nothing of Python', ([where, message]) => {
        let error;

        try {
            mount(RaiseAtExits, { target: document.body.appendChild(document.createElement('div')), props: { where } });
            flushSync();
        } catch (caught) {
            error = caught;
        }

        expect(plain(error)).toEqual([true, ['message', 'stack'], message]);
    });

    test('leaves on_destroy as one', async () => {
        const instance = mount(RaiseAtExits, { target: document.body.appendChild(document.createElement('div')), props: { where: 'on_destroy' } });
        let error;

        flushSync();
        try {
            await unmount(instance);
        } catch (caught) {
            error = caught;
        }

        expect(plain(error)).toEqual([true, ['message', 'stack'], 'ValueError: on_destroy']);
    });

    test('leaves an export JavaScript calls as one, which Python catches as its own again', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(RaiseAtExits, { target });
        let error;

        globalThis.globalThrough = (callback) => callback();
        flushSync();
        try {
            instance.boom();
        } catch (caught) {
            error = caught;
        }
        target.querySelector('[data-k="guarded"]').click();
        flushSync();

        expect(plain(error)).toEqual([true, ['message', 'stack'], 'ValueError: export']);
        expect(target.querySelector('[data-k="seen"]').textContent).toBe('ValueError ValueError');
    });
});
