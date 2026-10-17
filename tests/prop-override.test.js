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
import PropWriteKindsHost from './fixtures/PropWriteKindsHost.svelte';
import PropWriteKindsHostNative from './fixtures/PropWriteKindsHostNative.svelte';

const run = (child, steps) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(PropOverrideHost, { target, props: { child } });
    const seen = [];

    flushSync();

    // A step that is a list is several writes in one batch, the parent's, the
    // child's (`own`) and a read of the child's model (`read`), before a render.
    for (const step of steps) {
        for (const one of Array.isArray(step) ? step : [step]) {
            if (one === 'own') host.own();
            else if (one === 'read') host.model();
            else host.give(one);
        }
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
    ['the parent passes zero, the child writes, the parent goes and comes back to zero', [0, 'own', [0.75, 0]]],
    // The child writing again the value it wrote changes nothing of the prop,
    // as Svelte compares a write with what the prop holds: a value the parent
    // passed in the same batch, not read yet, is what the prop reads next. The
    // write read the prop first, which took the parent's value in, and then
    // hid it under the child's.
    ['the parent passes a value and the child writes its own again before a render', ['own', [0.75, 'own']]],
    ['the parent passes nothing and the child writes its own again before a render', ['own', [undefined, 'own']]],
    ['the parent passes two values and the child writes its own again before a render', ['own', [0.25, 0.75, 'own']]],
    ['the parent passes a value, the child reads it, then writes its own again', ['own', [0.75, 'read', 'own']]],
    // And a write compared with what JavaScript holds of the default the
    // child wrote, its number, and not with the Python float itself.
    ['the child writes while nothing is passed, then again after the parent passes a value', [[undefined, 'own'], [0.75, undefined], [0.75, 'own']]]
])('%s: the prop reads and shows what a Svelte child has', ([, steps]) => {
    const native = run(PropOverrideChildNative, steps);

    expect(run(PropOverrideChild, steps)).toEqual(native);
});

// And under a Python parent, which passes its own value: its float or its
// string out of the BMP was never `===` to the child's write of the same value,
// which then hid the parent's next one. The parent passes a value, then in one
// batch another, and the child writes the first again.
const KINDS = ['float', 'int', 'str', 'astral', 'big', 'true'];

const written = (Host, kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(Host, { target });

    flushSync();
    host.give(kind);
    flushSync();
    host.give('other');
    host.own(kind);
    flushSync();

    return [host.model(), target.querySelector('p').textContent];
};

test.for(KINDS)('under a Python parent, the child writing the %s the parent passed leaves its next value, as in Svelte', (kind) => {
    const native = written(PropWriteKindsHostNative, kind);

    expect(written(PropWriteKindsHost, kind)).toEqual(native);
    expect(native).toEqual(['0.75', '0.75']);
});

// None the parent passes is the absence, which the prop reads its default for:
// the child writing None writes another value than the one the prop holds, and
// keeps it, as a Svelte child writing `undefined` does.
test('under a Python parent, the child writing the None the parent passed keeps it, as a Svelte child keeps undefined', () => {
    expect(written(PropWriteKindsHostNative, 'none')).toEqual(['undefined', '']);
    expect(written(PropWriteKindsHost, 'none')).toEqual(['None', '']);
});

// The witness: the native child does what the rule says, read and shown alike.
test('the Svelte child is the rule', () => {
    expect(run(PropOverrideChildNative, ['own', 0.75, undefined])).toEqual([
        ['0.5', '0.5'],
        ['0.75', '0.75'],
        ['0.25', '0.25']
    ]);
});
