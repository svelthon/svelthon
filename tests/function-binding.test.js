// Svelte 5's function binding, `bind:value={get, set}`, was read as a tuple to
// assign: the field showed the source of an adapter, and what was typed was
// unpacked into two locals, two characters in silence. It is Svelte's pair: the
// read calls the first, the write hands the value to the second.
import { test, expect } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import FunctionBinding from './fixtures/FunctionBinding.svelte';
import FunctionBindingHeld from './fixtures/FunctionBindingHeld.svelte';
import FunctionBindingAsync from './fixtures/FunctionBindingAsync.svelte';
import FunctionBindingAnswer from './fixtures/FunctionBindingAnswer.svelte';

test('a function binding reads through its getter and writes through its setter', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(FunctionBinding, { target });
    flushSync();

    const field = (k) => target.querySelector(`[data-k="${k}"]`);
    const shown = () => ['bare', 'grouped', 'lambdas'].map((k) => field(k).value);

    expect(shown()).toEqual(['S', 'S', 'ss']);

    field('grouped').value = 'abc';
    field('grouped').dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect([field('text').textContent, ...shown()]).toEqual(['abc', 'ABC', 'ABC', 'abcabc']);
});

// Svelte evaluates the pair once, where the binding is made. `make_put()` was
// evaluated by every write, and `make_get()` by every read: the count of the
// setter's closure started over, `two#1` where Svelte shows `two#2`.
test('the halves of a function binding are evaluated once', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(FunctionBindingHeld, { target });
    flushSync();

    const field = target.querySelector('input');
    const typed = (value) => {
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();

        return [target.querySelector('p').textContent, field.value];
    };

    expect(field.value).toBe('initial|initial');
    expect(typed('one')).toEqual(['one#1', 'initial|one#1']);
    expect(typed('two')).toEqual(['two#2', 'initial|two#2']);
});

// Svelte calls an `async function put`, which runs. The setter's coroutine was
// dropped by the function the write compiled to, and never started.
test('an async setter runs, with or without an await', async () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(FunctionBindingAsync, { target });
    flushSync();

    for (const k of ['now', 'later']) {
        const field = target.querySelector(`[data-k="${k}"]`);

        field.value = 'one';
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }

    await settled(() => expect(target.querySelector('p').textContent).toBe('ONE|ONE'));
});

// Svelte reads nothing back from a setter. What it answered was converted as a
// read is, and a generator walked: its body ran on every keystroke.
test("what a setter answers is left unread, a coroutine's answer too", async () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(FunctionBindingAnswer, { target });
    flushSync();

    const typed = (k, value) => {
        const field = target.querySelector(`[data-k="${k}"]`);

        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        flushSync();
    };
    const shown = () => target.querySelector('p').textContent;

    typed('now', 'one');
    expect(shown()).toBe('ONE|0');

    typed('later', 'two');
    await settled(() => expect(shown().startsWith('TWO|')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 20));
    flushSync();
    expect(shown()).toBe('TWO|0');
});
