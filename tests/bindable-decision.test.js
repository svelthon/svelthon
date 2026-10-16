// **A bound parent decides what its prop holds, and the child reads that.** A
// parent binds with a getter and a setter to check or normalize what a child
// proposes; a Python child read its own proposal again, the list or the dict it
// wrote, after the parent had refused it or put another in its place. The
// write had remembered what it wrote under whatever the prop held after it, for
// the day Svelte wrapped a Brython list in a proxy of its own, which it no
// longer does: a container crosses as its view.
//
// The witness is the same child in Svelte, under the same parent, whose reads
// and render the Python child's are held against.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import BindableDecision from './fixtures/BindableDecision.svelte';
import BindableDecisionNative from './fixtures/BindableDecisionNative.svelte';
import BindableDecisionHost from './fixtures/BindableDecisionHost.svelte';
import BindableUnbound from './fixtures/BindableUnbound.svelte';

const decided = (Child, kind, mode) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(BindableDecisionHost, { target, props: { Child, kind, mode } });

    try {
        flushSync();
        host.change();
        flushSync();

        return { ...host.read(), shown: target.querySelector('[data-k="child"]').textContent };
    } finally {
        unmount(host);
        target.remove();
    }
};

test.for(
    ['array', 'object', 'scalar'].flatMap((kind) => ['reject', 'normalize', 'accept'].map((mode) => [kind, mode]))
)('a %s the parent will %s reads as the parent decided, as in Svelte', ([kind, mode]) => {
    expect(decided(BindableDecision, kind, mode)).toEqual(decided(BindableDecisionNative, kind, mode));
});

// What that memory was for, which the view does now: a container written into a
// prop no parent binds is itself again, as `value is written` is true in Python.
test('a list, a dict or an instance written into an unbound bindable is itself again', () => {
    for (const [kind, shown] of [['list', 'list'], ['dict', 'dict'], ['instance', 'Box']]) {
        const target = document.body.appendChild(document.createElement('div'));
        const child = mount(BindableUnbound, { target, props: { kind } });

        flushSync();
        child.change();
        flushSync();

        expect(child.same(), kind).toBe(true);
        expect(target.textContent.trim(), kind).toBe(shown);
        target.remove();
    }
});
