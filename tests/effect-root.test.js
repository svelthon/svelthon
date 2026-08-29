import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { mount, flushSync } from 'svelte';
import EffectRoot from './fixtures/EffectRoot.svelte';
import RootStore from './fixtures/RootStore.svelte';

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
