import { test, expect } from 'vitest';
import { mount, flushSync } from 'svelte';
import Clean from './fixtures/CleanHost.svelte';
import Js from './fixtures/JsHost.svelte';

const settled = () => {
    for (const _ of [0, 1, 2]) global.gc();
    return process.memoryUsage().heapUsed;
};

const run = (Host) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Host, { target });
    flushSync();

    const before = settled();

    for (let i = 0; i < 500; i++) {
        target.querySelector('button').click();
        flushSync();
        target.querySelector('button').click();
        flushSync();
    }

    return Math.round((settled() - before) / 500) + ' B / mount';
};

test('p', () => {
    expect([run(Js), run(Clean)]).toBe('X');
});
