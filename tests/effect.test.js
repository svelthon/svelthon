import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import Effects from './fixtures/Effects.svelte';

// @effect replays the body when a name it *read* changes. Nothing to declare:
// globals go through the namespace accessors, so reading them reads signals, and
// Svelte infers the dependencies.
//
// A trap that belongs to this model: `runs += 1` on a module-level name **reads**
// before it writes, so a counter incremented inside an effect makes the effect
// depend on what it writes — and Svelte loops. A plain assignment reads nothing.
describe('@effect', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Effects, { target });
        flushSync();
        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('the body runs on mount', () => {
        const { read } = setup();

        expect(read('seen')).toBe('count=0');
        expect(read('torn')).toBe('-'); // nothing to tear down yet
    });

    test('it replays when a dependency changes', () => {
        const { read, click } = setup();

        click('bump');
        expect(read('seen')).toBe('count=1');
    });

    test('the returned function is the cleanup, before every replay', () => {
        const { read, click } = setup();

        click('bump');
        expect(read('torn')).toBe('torn at 0'); // closed over the previous value
    });

    test('it does not replay for a name it never reads', () => {
        const { read, click } = setup();

        click('other');
        expect(read('seen')).toBe('count=0');
        expect(read('torn')).toBe('-');
        expect(read('other')).toBe('1'); // the name did change
    });
});
