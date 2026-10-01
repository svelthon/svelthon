// A derived and an effect are called the way Python calls them: a decorator may
// hand back a callable instance or a bound method, which an export already
// accepted, and the body stays reactive.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DecoratedRunes from './fixtures/DecoratedRunes.svelte';

test('a derived and an effect decorated into callables run and follow their state', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(DecoratedRunes, { target });
    flushSync();
    const seen = () => target.querySelector('[data-k="seen"]').textContent;

    expect(seen()).toBe('2 3 1');

    target.querySelector('button[data-k="bump"]').click();
    flushSync();
    expect(seen()).toBe('4 6 2');
});
