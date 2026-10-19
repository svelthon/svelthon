// **A write of the value a name holds tells nobody**, as Svelte's `$state`
// tells nobody of a value `===` to the one it holds. An effect normalising what
// it reads, `x = round(x, 2)`, ran for ever: a float is an object of the
// engine's, so the same number written again was a new value to Svelte, in a
// state, a prop and a bindable, and a prop's write told its readers whatever
// it wrote, `x = x` among them. A bindable bound by a parent ran its effect
// twice for each change, the float its number reads as and the float written
// over it being two objects; and a prop the parent leaves out ran it twice at
// mount, a write of its default taken for a change of the derived Svelte reads
// the parent's value through.
//
// A write Svelte refuses, in a derived, is refused whatever it writes.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SameValueWrite from './fixtures/SameValueWrite.svelte';
import SameValueWriteNative from './fixtures/SameValueWriteNative.svelte';
import SameValueParent from './fixtures/SameValueParent.svelte';

const runs = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    let count = 0;
    const tick = () => {
        count += 1;
    };
    let seen;

    try {
        const instance = mount(Component, { target, props: { ...props, tick } });
        flushSync();
        seen = `${count}`;
        instance.change();
        flushSync();
        seen += ` ${count} ${target.textContent}`;
    } catch (error) {
        seen = /state_unsafe_mutation/.test(String(error?.message ?? error)) ? 'refused' : `failed after ${count}`;
    }

    return seen;
};

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [
            ['state', {}],
            ['state same', {}],
            ['prop', {}],
            ['prop passed', { ratio: 1.5 }],
            ['bindable', {}]
        ].map(([kind, props]) => [language, kind, props])
    )
)('%s: an effect writing %s back runs once a change', ([language, kind, props]) => {
    const Component = language === 'Python' ? SameValueWrite : SameValueWriteNative;

    expect(runs(Component, { kind: kind.replace(' passed', ''), ...props })).toBe('1 2 2.5 2.5 2.5 5');
});

test.for(['Python', 'Svelte'])('%s: a bound bindable written back runs once a change', (language) => {
    const child = language === 'Python' ? SameValueWrite : SameValueWriteNative;

    expect(runs(SameValueParent, { child })).toBe('1 2 1.5 1.5 2.5 3');
});

test.for(['Python', 'Svelte'])('%s: the same value written in a derived is refused', (language) => {
    const Component = language === 'Python' ? SameValueWrite : SameValueWriteNative;

    expect(runs(Component, { kind: 'derived write' })).toBe('refused');
});
