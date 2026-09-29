// Two surfaces seen from outside the component that declares them.
//
// A `.svelte.py` store's own reactivity: a root effect follows what it reads
// and stops when Python calls the destructor its decorated name holds, and a
// derived follows a mutation nested in a row.
//
// A component's instance API, called by a JavaScript parent that holds it by
// `bind:this`: the values are JavaScript's, a float a number, a coroutine a
// promise, a dict a plain object, and each function has its arity.
import { test, expect, describe, beforeEach, vi } from 'vitest';
import { mount, flushSync } from './mounted.js';
import store from './fixtures/journaled_store.svelte.py';
import JournalView from './fixtures/JournalView.svelte';
import ExportHost from './fixtures/ExportHost.svelte';
import EffectLoopJs from './fixtures/EffectLoopJs.svelte';
import EffectLoopPy from './fixtures/EffectLoopPy.svelte';

// Svelte's own trap, and Svelthon shares it rather than hiding it: an effect
// that reads the state it changes runs again on its own write, until Svelte
// stops it. `history.append(count)` reads `history`, as `history.push` does.
test.for([
    ['JavaScript', EffectLoopJs],
    ['Python', EffectLoopPy]
])('an effect that changes what it reads loops in %s alike', ([, Component]) => {
    const said = [];
    const heard = (event) => {
        said.push(String(event.error?.message ?? event.message));
        event.preventDefault();
    };

    // Svelte logs the loop it stops as well as raising it; expected here, so
    // kept off the output the quiet check reads.
    const logged = ['error', 'warn'].map((level) =>
        vi.spyOn(console, level).mockImplementation((...args) => said.push(args.join(' ')))
    );

    window.addEventListener('error', heard);
    try {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
    } catch (error) {
        said.push(String(error.message));
    } finally {
        window.removeEventListener('error', heard);
        for (const spy of logged) spy.mockRestore();
    }

    expect(said.join(' ')).toMatch(/effect_update_depth_exceeded/);
});

describe('a store with a root effect and a derived', () => {
    // The store lives as long as the module, so each step reads what changed;
    // the view is mounted again for each, since every test ends by unmounting.
    let read;

    beforeEach(() => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(JournalView, { target });
        flushSync();
        read = (key) => target.querySelector(`.${key}`).textContent;
    });

    test('the root effect ran on creation and follows what it reads', () => {
        const before = Number(read('count'));

        store.bump();
        flushSync();

        expect(read('count')).toBe(String(before + 1));
        expect(read('last')).toBe(String(before + 1));
    });

    test('the derived follows a mutation nested in a row', () => {
        expect(read('remaining')).toBe('2');

        store.finish_first();
        flushSync();

        expect(read('remaining')).toBe('1');
    });

    test('the destructor stops the root effect', () => {
        const stopped = read('last');

        store.stop();
        store.bump();
        flushSync();

        expect(read('count')).toBe(String(Number(stopped) + 1));
        expect(read('last')).toBe(stopped);
    });
});

describe('an instance API called by a JavaScript parent', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const host = mount(ExportHost, { target });
        flushSync();
        return { counter: host.handle(), target };
    };

    test('a float comes back as a JavaScript number, and the page follows', () => {
        const { counter, target } = setup();

        const half = counter.add(3);
        flushSync();

        expect(half).toBe(1.5);
        expect(target.querySelector('.inner').textContent).toBe('3');
    });

    test('an async def comes back as a promise of its value', async () => {
        await expect(setup().counter.later(21)).resolves.toBe(42);
    });

    // Read by its string keys: what a component's export hands back is the
    // Python dict itself, whose engine fields sit under symbols. Whether it
    // should be a copy, as a module's export is, is an open decision.
    test('export(lambda: …) hands back its data', () => {
        const { counter } = setup();
        counter.add(3);

        expect(Object.fromEntries(Object.entries(counter.snapshot()))).toEqual({ count: 3, ratio: 0.75 });
    });

    test('each function has the arity of its def', () => {
        const { counter } = setup();

        expect(counter.add.length).toBe(1);
        expect(counter.later.length).toBe(1);
        expect(counter.snapshot.length).toBe(0);
    });
});
