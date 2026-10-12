import { test, expect, describe } from 'vitest';
import { hydrate, flushSync } from 'svelte';
import Counter from '../demo/Counter.svelte';

// Svelte's third mode, after client and server: the HTML comes from the server
// and the client latches onto it instead of rebuilding everything. This is where
// the two renders have to agree — and the Python body runs on both sides.
//
// The string below is exactly what render() produces; tests/ssr.test.js asserts
// it, so the two cannot drift apart in silence.
const SERVER_HTML = '<!--[--><button>increment()</button> <output>0</output><!--]-->';

function serverRendered(html = SERVER_HTML) {
    const target = document.body.appendChild(document.createElement('div'));
    target.innerHTML = html;
    return target;
}

describe('hydration', () => {
    test('the server’s nodes are reused, not rebuilt', () => {
        const target = serverRendered();
        const button = target.querySelector('button');
        const output = target.querySelector('output');

        hydrate(Counter, { target });
        flushSync();

        // The proof that hydration happened: node identity survives.
        expect(target.querySelector('button')).toBe(button);
        expect(target.querySelector('output')).toBe(output);
    });

    test('the Python is wired to the reclaimed nodes', () => {
        const target = serverRendered();

        hydrate(Counter, { target });
        flushSync();

        target.querySelector('button').click();
        flushSync();

        expect(target.querySelector('output').textContent).toBe('1');
    });

    test('on a mismatch the client wins — silently', () => {
        // The non-deterministic component case: a clock, a random, a session.
        const target = serverRendered(
            '<!--[--><button>increment()</button> <output>7</output><!--]-->'
        );
        const warnings = [];
        const original = console.warn;
        console.warn = (...args) => warnings.push(args.join(' '));

        try {
            hydrate(Counter, { target });
            flushSync();
        } finally {
            console.warn = original;
        }

        expect(target.querySelector('output').textContent).toBe('0');
        expect(warnings).toEqual([]); // nothing warns: the page flickers, that is all
    });
});
