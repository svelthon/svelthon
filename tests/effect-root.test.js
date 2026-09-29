import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { mount, flushSync } from './mounted.js';
import EffectRoot from './fixtures/EffectRoot.svelte';
import RootStore from './fixtures/RootStore.svelte';
import RootOutlives, { held } from './fixtures/RootOutlives.svelte';
import { events } from './fixtures/lifecycle_log.js';
import { unmount } from './mounted.js';

// A root outlives its component, and so do the subscriptions it reads through:
// a list mutated after the unmount still re-runs it, until its destructor is
// called.
test('a root still follows a mutated list after its component is gone', () => {
    events.length = 0;
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(RootOutlives, { target });
    flushSync();

    const { mutate, stop } = held();

    try {
        unmount(instance);
        mutate();
        flushSync();

        expect(events).toEqual([0, 1]);
    } finally {
        stop();
    }

    // Destroyed, it follows nothing.
    mutate();
    flushSync();
    expect(events).toEqual([0, 1]);
});

// `@effect.root` makes a scope that owns itself: nothing cleans it up, and the
// destructor is handed back. In JavaScript that destructor is the value of the
// call — `const destroy = $effect.root(…)` — so the name belongs to it there
// too, and the decorated name receives it here for the same reason.
//
// It is also the form a `.svelte.py` writes, since a module has no component to
// belong to.
describe('@effect.root', () => {
    const setup = () => {
        document.body.setAttribute('data-root', '');

        const target = document.body.appendChild(document.createElement('div'));
        mount(EffectRoot, { target });
        flushSync();

        const click = (k) => {
            target.querySelector(`button[data-k="${k}"]`).click();
            flushSync();
        };

        return { ran: () => document.body.getAttribute('data-root'), click };
    };

    test('it runs like any effect', () => {
        expect(setup().ran()).toBe('r');
    });

    test('and re-runs when what it read has changed', () => {
        const { ran, click } = setup();

        click('bump');
        expect(ran()).toBe('rr');
    });

    // The whole point: the destructor is reachable, and calling it ends the
    // effect while the component is still alive.
    test('calling the decorated name destroys it', () => {
        const { ran, click } = setup();

        click('stop');
        click('bump');
        expect(ran()).toBe('r');
    });
});

// `root` is a scope and `pre` is a moment: in JavaScript they nest —
// `$effect.root(() => { $effect.pre(() => …) })` — so they must compose here
// too. Stacking is Python's own way of saying that, and each decorator is read
// independently, so the order carries no meaning and neither does its reverse.
describe('a root and a pre together', () => {
    const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

    const emitted = (decorators) =>
        compile(`c = 0\n\n${decorators}\ndef destroy():\n    js.String(c)\n`, 'Probe', 'probe.svelte', {})
            .script.split('\n')
            .find((line) => line.includes('$effect.root'));

    test('nest', () => {
        expect(emitted('@effect.root\n@effect.pre')).toContain('$effect.root(() => { $effect.pre(');
    });

    test('and a root alone stays a plain effect inside', () => {
        expect(emitted('@effect.root')).toContain('$effect.root(() => { $effect(');
    });
});

// The reason `@effect.root` exists here rather than only in components: a
// `.svelte.py` has no component to belong to, so a plain `@effect` there used to
// become an ordinary exported function — reactive-looking and inert.
describe('an effect in a shared module', () => {
    const seen = () => (document.body.getAttribute('data-store') || '').length;

    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(RootStore, { target });
        flushSync();

        return (k) => {
            target.querySelector(`button[data-k="${k}"]`).click();
            flushSync();
        };
    };

    test('it runs, re-runs, and stops when destroyed', () => {
        const click = setup();
        const start = seen();

        click('bump');
        expect(seen()).toBe(start + 1);

        click('stop');
        click('bump');
        expect(seen()).toBe(start + 1);
    });

    // The forms a module may not use, refused rather than quietly demoted.
    describe('what a module cannot write', () => {
        const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

        const refusal = (src, options) => {
            try {
                compile(src, 'Probe', 'probe.py', options);
            } catch (error) {
                return error.message;
            }

            throw new Error('expected a SyntaxError');
        };

        test('a plain @effect in a .svelte.py', () => {
            expect(refusal('c = 0\n\n@effect\ndef w():\n    js.String(c)\n', { store: true }))
                .toContain('`@effect` belongs to a component');
        });

        test('and any effect at all in a plain .py, which holds no signals', () => {
            expect(refusal('c = 0\n\n@effect.root\ndef d():\n    js.String(c)\n', { plain: true }))
                .toContain('would watch nothing');
        });
    });
});
