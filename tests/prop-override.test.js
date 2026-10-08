// A prop the child writes to, as Svelte keeps one: the child's write is what
// the prop reads and shows until the parent passes a new value, and once the
// parent passes nothing, the prop is the declared default, unless the child
// wrote while nothing was passed. The model and the page, after each step,
// against the same child written in Svelte.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PropOverrideHost from './fixtures/PropOverrideHost.svelte';
import PropOverrideChild from './fixtures/PropOverrideChild.svelte';
import PropOverrideChildNative from './fixtures/PropOverrideChildNative.svelte';

const run = (child, steps) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(PropOverrideHost, { target, props: { child } });
    const seen = [];

    flushSync();

    // A step that is a list is several writes of the parent's in one batch.
    for (const step of steps) {
        if (step === 'own') host.own();
        else for (const one of Array.isArray(step) ? step : [step]) host.give(one);
        flushSync();
        seen.push([host.model(), target.querySelector('p').textContent]);
    }

    return seen;
};

test.for([
    ['the child writes', ['own']],
    ['the child writes, then the parent passes a value, then the child writes', ['own', 0.75, 'own']],
    ['the child writes, the parent passes a value, then nothing', ['own', 0.75, undefined]],
    ['the parent passes nothing, then the child writes', [undefined, 'own', undefined]],
    ['the parent passes zero, then the child writes', [0, 'own']],
    ['the child writes, the parent passes its own value again', ['own', 0.25]],
    ['the child writes, the parent passes a value and its own again in one batch', ['own', [0.75, 0.25]]],
    ['the child writes, the parent passes nothing and its own again in one batch', ['own', [undefined, 0.25]]],
    ['the parent passes zero, the child writes, the parent goes and comes back to zero', [0, 'own', [0.75, 0]]]
])('%s: the prop reads and shows what a Svelte child has', ([, steps]) => {
    const native = run(PropOverrideChildNative, steps);

    expect(run(PropOverrideChild, steps)).toEqual(native);
});

// The witness: the native child does what the rule says, read and shown alike.
test('the Svelte child is the rule', () => {
    expect(run(PropOverrideChildNative, ['own', 0.75, undefined])).toEqual([
        ['0.5', '0.5'],
        ['0.75', '0.75'],
        ['0.25', '0.25']
    ]);
});
