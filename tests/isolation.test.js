import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Isolated from './fixtures/Isolated.svelte';

// The Python module body is re-executed for every instance, and every name gets
// a signal of its own. Nothing may leak from one instance to another — mutable
// values created during initialisation included.
describe('isolation between instances', () => {
    const mountOne = (tag) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Isolated, { target, props: { tag } });
        return {
            read: () => target.querySelector('p[data-k="state"]').textContent,
            bump: () => {
                target.querySelector('button[data-k="bump"]').click();
                flushSync();
            }
        };
    };

    test('two instances share neither state nor a mutable default', () => {
        const a = mountOne('a');
        const b = mountOne('b');

        expect(a.read()).toBe('a:0:[]');
        expect(b.read()).toBe('b:0:[]');

        a.bump();
        a.bump();

        expect(a.read()).toBe('a:2:[1, 2]');
        expect(b.read()).toBe('b:0:[]'); // untouched

        b.bump();

        expect(a.read()).toBe('a:2:[1, 2]');
        expect(b.read()).toBe('b:1:[1]');
    });
});
