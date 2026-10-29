// **An export of a JavaScript namespace is read once**: `readAttr` read it to
// ask whether it was a function, and again to hand it over, so a namespace a
// proxy stands for, which answers each read anew, showed its second answer,
// `14` where the export gave `7`, and a handler it chose was its second.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { readAttr } from '../src/lib/bridge.js';
import * as namespace from './fixtures/namespace_reads.js';
import NamespaceReads from './fixtures/NamespaceReads.svelte';

// The namespace behind a proxy whose every read of `value` answers anew, and
// counts.
const counted = () => {
    const reads = { value: 0, action: 0 };
    const source = new Proxy(namespace, {
        get(target, key, receiver) {
            if (key === 'value') return 7 * ++reads.value;
            if (key === 'action') reads.action += 1;
            return Reflect.get(target, key, receiver);
        }
    });

    return { reads, source };
};

test('readAttr reads an export of a namespace once, a value, a defaulted value and a function', () => {
    const plain = counted();
    const defaulted = counted();
    const handler = counted();

    const read = [
        Number(readAttr(plain.source, 'value')),
        Number(readAttr(defaulted.source, 'value', () => 0)),
        typeof readAttr(handler.source, 'action')
    ];

    expect([read, plain.reads.value, defaulted.reads.value, handler.reads.action]).toEqual([[7, 7, 'function'], 1, 1, 1]);
});

test('a component reads an export of a namespace a proxy stands for once', () => {
    const direct = counted();
    const other = counted();
    const target = document.body.appendChild(document.createElement('div'));
    mount(NamespaceReads, { target, props: { source: direct.source, other: other.source } });
    flushSync();

    expect([
        ['direct', 'each'].map((key) => target.querySelector(`[data-k="${key}"]`).textContent),
        direct.reads.value,
        other.reads.value
    ]).toEqual([['7', '7'], 1, 1]);
});
