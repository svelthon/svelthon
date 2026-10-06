// A builtin method that takes nothing but its receiver, handed to JavaScript,
// received whatever JavaScript passed and refused it: `onclick={rows.clear}`
// raised `list.clear() takes no arguments (1 given)` on every click. It is
// handed nothing, as a `def` that declares no parameter is, by the list its type
// keeps of such methods. A builtin that takes arguments is still handed them all.
import { test, expect } from 'vitest';
import { flushSync } from 'svelte';
import { mount } from './mounted.js';
import NativeHandlers from './fixtures/NativeHandlers.svelte';
import { run } from './fixtures/native_callbacks.py';

test('a builtin method that takes nothing serves as an event handler', () => {
    const errors = [];
    const listen = (event) => {
        errors.push(event.error?.message ?? String(event.message));
        event.preventDefault();
    };
    const target = document.createElement('div');
    document.body.append(target);
    window.addEventListener('error', listen);
    try {
        mount(NativeHandlers, { target });
        for (const k of ['clear', 'reverse', 'dict', 'set', 'subclass']) {
            target.querySelector(`[data-k="${k}"]`).click();
        }
        flushSync();
    } finally {
        window.removeEventListener('error', listen);
    }

    expect(errors).toEqual([]);
    expect(target.querySelector('p').textContent).toBe('0 [3, 2, 1] 0 0 0');
});

test('and as a JavaScript callback, where a builtin that takes one is handed all', () => {
    const [rows, upper, appended] = run();

    expect([...rows]).toEqual([]);
    expect([...upper]).toEqual(['AB']);
    expect(appended).toMatch(/append\(\) takes exactly/);
});
