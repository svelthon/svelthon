// What an effect returns is a Python value, and the question asked of it was a
// JavaScript one: `typeof teardown === 'function'`.
//
// `resource.close` is the plainest teardown Python has — the method that closes
// the thing the effect opened — and it is a Brython object, `{ob_type: method,
// im_func, im_self}`. It failed that test, was dropped, and the effect simply
// had no cleanup: nothing raised, nothing warned, the listener stayed
// registered and the resource stayed open. A callable instance and a
// `@classmethod` fail it the same way.
//
// So the rows are every shape a Python value can be callable in, plus the two
// that are not callable at all and must still be ignored in silence. Each is
// measured twice, because a cleanup runs at two moments and only one of them is
// the one an author usually tests: before the body replays, and at destruction.
import { test, expect, describe } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import EffectCleanup from './fixtures/EffectCleanup.svelte';
import EffectVariantCleanup from './fixtures/EffectVariantCleanup.svelte';

describe.for([
    // How the effect names its cleanup, and what that cleanup says when it runs.
    ['bound', 'bound-close'],
    ['instance', 'instance-close'],
    ['classmethod', 'class-close'],
    // The three that already worked: a `@staticmethod` read off the class is the
    // plain function, and a lambda and a nested `def` are Brython functions,
    // which are JavaScript functions.
    ['static', 'static-close'],
    ['lambda', 'lambda-close'],
    ['nested', 'nested-close'],
    ['js', 'js-close']
])('an effect returning %s', ([how, closed]) => {
    test('has its cleanup run before the replay and at destruction', async () => {
        const calls = [];
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(EffectCleanup, {
            target,
            props: { how, notify: (value) => calls.push(value), js_cleanup: () => calls.push('js-close') }
        });

        flushSync();
        expect(calls).toEqual(['open:0']);

        instance.bump();
        flushSync();
        // The cleanup first, then the body again: an effect closes what it
        // opened before it opens the next one.
        expect(calls).toEqual(['open:0', closed, 'open:1']);

        await unmount(instance);
        expect(calls).toEqual(['open:0', closed, 'open:1', closed]);
    });
});

describe.for([
    // Nothing to run, and nothing to complain about either.
    ['none', 'None'],
    ['value', 'a list']
])('an effect returning %s', ([how]) => {
    test('replays and is destroyed with no cleanup and no error', async () => {
        const calls = [];
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(EffectCleanup, {
            target,
            props: { how, notify: (value) => calls.push(value) }
        });

        flushSync();
        instance.bump();
        flushSync();
        await unmount(instance);

        expect(calls).toEqual(['open:0', 'open:1']);
    });
});

// `@effect`, `@effect.pre` and `@effect.root` are three paths through the
// generator that emit the same teardown lines, and `.root` nests them inside a
// second call. So the recognition is checked on all three rather than assumed
// from the one the reproduction used.
test('every effect decorator recognises the same cleanup', async () => {
    const calls = [];
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(EffectVariantCleanup, {
        target,
        props: { notify: (value) => calls.push(value) }
    });

    flushSync();
    expect(calls.filter((value) => value.endsWith('-close'))).toEqual([]);

    instance.bump();
    flushSync();
    // Every one of the three closed before it reopened.
    expect(calls.filter((value) => value.endsWith('-close')).sort()).toEqual([
        'plain-close',
        'pre-close',
        'root-close'
    ]);

    // A root owns its own scope: the component going away does not end it, and
    // calling the name the decorator bound is what does.
    instance.end_root();
    flushSync();
    expect(calls.filter((value) => value === 'root-close')).toHaveLength(2);
});
