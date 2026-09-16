// The third scheduler, and the last one that started a coroutine on its own.
//
// `scheduleAsync` learned to take its run from a memo, so a coroutine returned
// by an exported function runs once however many times it is handed over.
// `schedule` — the DOM handler path, where nobody awaits the return value —
// still called `aio.run` itself, so a handler returning a shared coroutine ran
// its body again on every click.
//
// The comment claiming `started` was the only place that starts a coroutine was
// written with this site still open: two sites were active, and the audit read
// the sentence before the code agreed with it.
import { test, expect, describe } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import SharedHandler from './fixtures/SharedHandler.svelte';

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(SharedHandler, { target });
    flushSync();

    const read = () => target.querySelector('[data-k="total"]').textContent;

    return {
        read,
        click: (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        },
        // The body starting is what the counter shows; waiting on it is what
        // makes the second click a second *opportunity* to run rather than a
        // race with the first.
        ran: (n) => settled(() => expect(read()).toBe(String(n)))
    };
};

describe('a coroutine handed back by a DOM handler', () => {
    test('runs once however many times it is handed over', async () => {
        const { read, click, ran } = setup();

        click('go');
        await ran(1);

        click('go');
        await new Promise((resume) => setTimeout(resume));
        flushSync();

        expect(read()).toBe('1');
    });

    test('while a handler that builds a new one each time runs each of them', async () => {
        const { click, ran } = setup();

        click('fresh');
        await ran(1);

        click('fresh');
        await ran(2);
    });
});
