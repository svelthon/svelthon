// A Python function a library keeps and calls later reported its `raise` at the
// line of the Python block, not of the file: the callback is published once for
// every caller, with no component around it, and it handed the error an offset
// of 0, so markup above the `<script>` put the line that many lines too high.
// A frame in another file than the one called, `raised in fail(), …`, was
// placed the same way. Each component registers its offset under its file, and
// a frame is placed by the offset of the file it is in.
//
// The witness is the same function called through the component's export,
// which knows its offset, and the file's own text, which says where the `raise`
// is.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mount, unmount, flushSync } from './mounted.js';
import CallbackLine from './fixtures/CallbackLine.svelte';
import { call, held } from './fixtures/kept_callback.js';

const text = readFileSync('tests/fixtures/CallbackLine.svelte', 'utf8');
const line = text.slice(0, text.indexOf('    raise ValueError')).split('\n').length;

const message = (run) => {
    try {
        run();
    } catch (error) {
        return error.message;
    }
};

test('a kept callback reports the line of its file, as the export does', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(CallbackLine, { target });
    flushSync();

    try {
        expect(line).toBe(13);
        expect(message(() => instance.direct())).toContain(`CallbackLine.svelte:${line})`);
        expect(message(call)).toContain(`CallbackLine.svelte:${line})`);
    } finally {
        await unmount(instance);
        target.remove();
    }
});

test('and a frame raised in the component under another file’s call', async () => {
    const { run } = await import('./fixtures/run_callback.py');
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(CallbackLine, { target });
    flushSync();

    try {
        expect(message(() => run(held()))).toContain(`raised in fail(), tests/fixtures/CallbackLine.svelte:${line})`);
    } finally {
        await unmount(instance);
        target.remove();
    }
});
