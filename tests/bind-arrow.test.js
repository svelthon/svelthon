import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { mount, flushSync } from './mounted.js';
import BindArrowHost from './fixtures/BindArrowHost.svelte';

// `value: str <=>` — the fourth of the dialect's bindings, and the only one that
// had to be written as a word. They are one system built around the same sign:
//
//     count = 0              a name to a value, once
//     doubled => count * 2   a name to an expression, re-run
//     (open := not open)     a name from inside an expression
//     value: str <=>         two names, parent and child, both ways
//
// Sugar over `bindable()`, which stays — a searchable name for whoever arrives
// from Svelte's `$bindable`, exactly as `derived(lambda: …)` stays under `=>`.
describe('the bindable arrow', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(BindArrowHost, { target });
        flushSync();

        const read = (where, k) =>
            target.querySelector(`div[data-k="${where}"] output[data-k="${k}"]`).textContent;

        return {
            read,
            parent: () => target.querySelector('p[data-k="parent"]').textContent,
            shout: (where) => {
                target.querySelector(`div[data-k="${where}"] button`).click();
                flushSync();
            }
        };
    };

    test('the parent value reaches the child', () => {
        expect(setup().read('bound', 'value')).toBe('hello');
    });

    // The whole point: what the child writes travels back up.
    test('and what the child writes travels back up', () => {
        const { parent, shout } = setup();

        shout('bound');
        expect(parent()).toBe('HELLO');
    });

    // A prop nobody passes reads as None, which a template shows as nothing.
    test('an unbound instance gets nothing', () => {
        expect(setup().read('unbound', 'value')).toBe('');
    });

    // And the two instances are independent: the bound one writing back does not
    // reach the other.
    test('and one instance writing back leaves the other alone', () => {
        const { read, shout } = setup();

        shout('bound');
        expect(read('unbound', 'value')).toBe('');
    });

    test('a fallback after the arrow stands in', () => {
        expect(setup().read('unbound', 'tag')).toBe('default');
    });

    describe('the rewrite', () => {
        const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

        const emitted = (src, options = {}) =>
            compile(src, 'Probe', options.plain ? 'probe.py' : 'probe.svelte', options).script;

        // Both spellings must produce the same binding, or the sugar would be a
        // second behaviour rather than a second spelling.
        test('is the one bindable() produces', () => {
            const arrow = emitted('value: str <=>\n').match(/bind\(__proto, 'value'.*/)[0];
            const word = emitted('value: str = bindable()\n').match(/bind\(__proto, 'value'.*/)[0];

            expect(arrow).toBe(word);
        });

        test('and a module has no parent to bind with', () => {
            expect(() => emitted('value: str <=>\n', { plain: true })).toThrow(/belongs to a component/);
        });
    });
});
