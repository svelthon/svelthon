import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import LazyConfig from './fixtures/LazyConfig.svelte';
import LazyConfigNative from './fixtures/LazyConfigNative.svelte';
import { make, reset, readCount } from './fixtures/lazy_config.js';
import { config } from './fixtures/lazy_export.py';

// A JavaScript object leaving Python goes on as itself, as it leaves a
// JavaScript function: a getter on it is JavaScript's, run when someone reads
// that field and not before, and the object is the one JavaScript made. The
// same component written in JavaScript is the witness, by every way out: an
// `@export`, an action, a callback JavaScript calls.

// First, before anything resets the count: a module's export, read by nobody
// yet.
test('a JavaScript object a module exports crosses with its getter unread', () => {
    expect(readCount()).toBe(0);
    expect(config.unused).toBe(42);
    expect(readCount()).toBe(1);
});

const handedOn = (Component) => {
    reset();
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    flushSync();

    const reads = (call) => {
        reset();
        const out = call();

        return { duration: out.duration, reads: readCount() };
    };
    const kinds = ['counting', 'raising', 'hidden'];
    const crossed = {
        mounted: { installed: target.querySelector('[data-k="acted"]').dataset.installed, reads: readCount() },
        given: kinds.map((kind) => reads(() => instance.give(kind))),
        made: kinds.map((kind) => reads(() => instance.maker()(kind))),
        echoed: (() => {
            const value = make('raising');

            reset();
            return { same: instance.echo()(value) === value, reads: readCount() };
        })()
    };

    unmount(instance);
    target.remove();

    return crossed;
};

test('a getter on a JavaScript object leaving Python is not run by the crossing', () => {
    const python = handedOn(LazyConfig);

    expect(python).toEqual(handedOn(LazyConfigNative));
    expect(python.mounted).toEqual({ installed: 'yes', reads: 0 });
    expect(python.given[1]).toEqual({ duration: 0, reads: 0 });
    expect(python.made[1]).toEqual({ duration: 0, reads: 0 });
    expect(python.echoed).toEqual({ same: true, reads: 0 });
});

test('the getter still runs, and still throws, when the field is read', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(LazyConfig, { target });
    flushSync();

    reset();
    expect(instance.give('counting').unused).toBe(42);
    expect(readCount()).toBe(1);
    expect(() => instance.give('raising').unused).toThrow('unused field read');

    unmount(instance);
    target.remove();
});
