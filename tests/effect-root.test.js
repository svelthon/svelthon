import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { compile } from '../src/lib/compile.js';
import EffectRoot from './fixtures/EffectRoot.svelte';
import RootStore from './fixtures/RootStore.svelte';
import RootOutlives, { held } from './fixtures/RootOutlives.svelte';
import RootEarly from './fixtures/RootEarly.svelte';
import RootStopsItself from './fixtures/RootStopsItself.svelte';
import RootCleanupReads from './fixtures/RootCleanupReads.svelte';
import PreCleanupGlobal from './fixtures/PreCleanupGlobal.svelte';
import './fixtures/root_early.svelte.py';
import { runs } from './fixtures/root_early_log.js';
import { attempt, stop_first, bump, same, kept_name, stop_kept } from './fixtures/root_retry_driver.py';
import { runs as retried } from './fixtures/root_retry_log.js';
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

// And its destructor is the name's as soon as the `def` has run, as Svelte
// hands it back at once: called while the body runs, the root never runs its
// effect, and kept under another name, it stops the root later. The roots are
// made after the body, which read `undefined` there and raised `NameError`.
test('a root can be stopped or kept while the body runs', () => {
    events.length = 0;
    const target = document.body.appendChild(document.createElement('div'));
    mount(RootEarly, { target });
    flushSync();

    const click = (k) => {
        target.querySelector(`button[data-k="${k}"]`).click();
        flushSync();
    };

    expect(events).toEqual(['kept']);

    click('bump');
    expect(events).toEqual(['kept', 'kept']);

    click('finish');
    click('bump');
    expect(events).toEqual(['kept', 'kept']);
});

// Stopped while it is made, by a pre effect that runs as the root is made, it
// is destroyed once made, its cleanup run, as Svelte's root is. The request
// was lost: the root ran on, past its component's unmount.
test('a root stopped while it is made is destroyed once made', () => {
    const seen = [];
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(RootStopsItself, { target, props: { capture: (...row) => seen.push(row.join(':')) } });
    flushSync();
    expect(seen).toEqual(['run:0', 'clean:0']);

    instance.bump();
    flushSync();
    unmount(instance);
    instance.bump();
    flushSync();
    expect(seen).toEqual(['run:0', 'clean:0']);
});

// And its cleanup, run before the first flush, reads each name as the body
// left it. A name's cell is born `undefined` and the body writes it, and
// Svelte hands a cleanup run before the batch ends what a state held before
// it: the placeholder, read as a name not bound, so a cleanup reading a state,
// a function or a rune's name raised NameError and the mount failed.
const RUNS = { state: 7, function: 'h', derived: 14, effect: true, root: true, prop: 'x', bindable: 't', def: 7 };

test.for(Object.entries(RUNS))('a cleanup run as its root is made reads %s as the body left it', ([mode, value]) => {
    const seen = [];
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(RootCleanupReads, { target, props: { mode, capture: (...row) => seen.push(row.join(':')) } });
    flushSync();
    unmount(instance);

    expect(seen).toEqual(['run:7', `clean:${value}`]);
});

test('a pre cleanup run before the first flush reads a global as the body left it', () => {
    const seen = [];
    const target = document.body.appendChild(document.createElement('div'));
    unmount(mount(PreCleanupGlobal, { target, props: { capture: (...row) => seen.push(row.join(':')) } }));

    expect(seen).toEqual(['run:7', 'clean:7']);
});

test('and so in a module, by its name or another', () => {
    flushSync();
    expect(runs).toEqual([]);
});

// A store with no `__all__` publishes every name it binds, its root's
// destructor among them: JavaScript stops the root by that name, where
// `store.stop` was undefined and only a Python function could stop it.
test('and from JavaScript, by its name on a store with no __all__', async () => {
    const { store } = await import('./fixtures/unlisted_store.svelte.py');

    flushSync();
    store.bump();
    flushSync();
    expect([store.n, store.seen]).toEqual([2, 2]);

    store.stop();
    store.bump();
    flushSync();
    expect([store.n, store.seen]).toEqual([3, 2]);
});

// A module whose first attempt stopped its root, kept its destructor and
// failed: the attempt that succeeds has a root of its own, which runs, and
// which the failed attempt's destructor does not stop. The two shared one, so
// the root never started, or the old destructor stopped the new one.
test('each attempt of a module has a root of its own', () => {
    expect([attempt(), attempt()]).toEqual(['failed', 'loaded']);
    flushSync();
    expect(retried).toEqual([0]);

    stop_first();
    bump();
    flushSync();
    expect(retried).toEqual([0, 1]);
    expect(same()).toBe(false);

    // And the failed module, kept, still names its destructor: the name read
    // as the effect's `def`, and calling it ran the effect's body.
    expect(kept_name()).toBe(true);
    stop_kept();
    flushSync();
    expect(retried).toEqual([0, 1]);
});

// `root` is a scope and `pre` is a moment: in JavaScript they nest —
// `$effect.root(() => { $effect.pre(() => …) })` — so they must compose here
// too. Stacking is Python's own way of saying that, and each decorator is read
// independently, so the order carries no meaning and neither does its reverse.
describe('a root and a pre together', () => {
    const emitted = (decorators) =>
        compile(`c = 0\n\n${decorators}\ndef destroy():\n    js.String(c)\n`, 'Probe', 'probe.svelte', {})
            .script.split('\n')
            .find((line) => line.includes('$effect.root(() => {'));

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
