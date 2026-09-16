// @vitest-environment node
//
// SvelteKit wraps `event.params` and `event.url` in proxies that record every
// key read, so it knows what a `load()` depended on, and its serialiser then
// refuses any symbol that found its way into the recorded set. Brython probes an
// object's symbols when it wraps it for Python, so Python must never touch the
// proxy.
//
// The defence is `pyArg`, which reads the proxy here, in JavaScript, and hands
// Python a snapshot. This is the test of that claim, and it exists because the
// claim had been written at the wrong site: `plainData` carried a comment saying
// it touched no symbol, and it touches two — measured, with the walk it replaced
// as the control. The sentence was true of the boundary and false of the
// function that repeated it.
import { test, expect, describe } from 'vitest';
import { pyArg } from '../src/lib/runtime.js';

const recording = (target, touched) =>
    new Proxy(target, {
        get(obj, key) {
            touched.push(typeof key === 'symbol' ? `S:${String(key)}` : key);
            return Reflect.get(obj, key);
        },
        ownKeys(obj) {
            touched.push('ownKeys');
            return Reflect.ownKeys(obj);
        }
    });

describe('a recording proxy at the inbound boundary', () => {
    test('is read in JavaScript and never handed to Python', () => {
        const touched = [];
        const event = {
            params: recording({ slug: 'pep-8' }, touched),
            url: new URL('https://example.test/pep-8?q=gil'),
            request: { method: 'GET' },
            route: { id: '/[slug]' }
        };

        const snapshot = pyArg(event);
        const $B = globalThis.__BRYTHON__;

        expect($B.$getitem($B.$getitem(snapshot, 'params'), 'slug')).toBe('pep-8');

        // The whole point: nothing Brython introduces ever lands in what the
        // framework recorded.
        expect(touched.filter((one) => one.startsWith('S:'))).toEqual([]);
    });
});
