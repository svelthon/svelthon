// **A mutator of a set or a dict that changes nothing writes nothing**, as
// Svelte's `SvelteSet` and `SvelteMap` write nothing, so a template may read
// through one: adding a member a set holds, discarding one it lacks, clearing an
// empty one, `setdefault` on a key a dict holds, `pop` of one it lacks with a
// default, an update that writes what is there already, and the same written
// `d[k] = d[k]` or `del d[k]` of a key it lacks. Each was announced
// as a mutation, and Svelte refused it while rendering, `state_unsafe_mutation`.
// So was a key's `__hash__` adding a member its set holds while the set adds
// the key it holds: the inner call was taken for a change without asking. And so
// was the same call on a JavaScript `Set` or `Map` the component holds, whose
// methods notified whatever they did, and then on one of another window, whose
// methods are not this window's, and then of a `Map` whose key or value Python
// holds as something of its own, a float, an int past 2⁵³, JavaScript's null
// or an object, set again as it was read, and of one holding a list, a dict, an
// instance or a function of Python's, which cross as their view or their
// handler. A real change is still refused, and so is a list's `extend([])`,
// which Svelte's array refuses too.
//
// The same write passes whatever its spelling, as a run of `SvelteMap.set`
// does: an update by keywords or by pairs, one to a dict whose keys are not all
// strings, and a float written equal to the one held, which were refused where
// `d["x"] = d["x"]` passed.
//
// Equal as Python shows it, though: `1.0` over `1`, `2` over `2.0` and `-0.0`
// over `0.0` are one number to JavaScript and two on the page, which kept the
// old one where the model held the new.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import NoopMutation from './fixtures/NoopMutation.svelte';
import NoopMutationNative from './fixtures/NoopMutationNative.svelte';
import SymmetricFill from './fixtures/SymmetricFill.svelte';
import TypedWrite from './fixtures/TypedWrite.svelte';

const shown = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));

    try {
        mount(Component, { target, props: { kind } });
        flushSync();

        return target.querySelector('output').textContent;
    } catch (error) {
        return /state_unsafe_mutation/.test(String(error?.message ?? error)) ? 'refused' : String(error);
    }
};

test.for(
    ['Python', 'Svelte'].flatMap((language) =>
        [
            ['set add present', '1'],
            ['set discard absent', '1'],
            ['set clear empty', '0'],
            ['set symmetric empty', '1'],
            ['set add nested present', '2'],
            ['dict setdefault present', 'yes'],
            ['dict pop absent', 'absent'],
            ['dict update empty', 'yes'],
            ['dict update same', 'yes'],
            ['dict setitem same', 'yes'],
            ['dict update keywords', 'yes'],
            ['dict update pairs', 'yes'],
            ['dict mixed update', 'yes'],
            ['dict setitem same float', 'yes'],
            ['dict del absent', 'yes'],
            ['js set add present', '1'],
            ['js set delete absent', '1'],
            ['js set clear empty', '0'],
            ['js map set same', 'yes'],
            ['js map delete absent', '1'],
            ['js map clear empty', '0'],
            ['frame set add present', '1'],
            ['frame set delete absent', '1'],
            ['frame map set same', 'yes'],
            ...['key', 'value'].flatMap((side) =>
                ['float', 'big', 'null', 'object'].map((form) => [`js map same ${side} ${form}`, '1'])
            ),
            ['js map new value float', 'refused'],
            ['js map new key big', 'refused'],
            ...['list', 'dict', 'instance', 'function', 'key'].map((held) => [`js map held same ${held}`, '5']),
            ['js map held new list', 'refused'],
            ['set add absent', 'refused'],
            ['set symmetric swap', 'refused'],
            ['set add nested absent', 'refused'],
            ['dict setdefault absent', 'refused'],
            ['dict setitem new value', 'refused'],
            ['js set add absent', 'refused'],
            ['js map set new', 'refused'],
            ['frame set add absent', 'refused'],
            ['list extend empty', 'refused']
        ].map(([kind, expected]) => [language, kind, expected])
    )
)('%s: %s while rendering shows %s', ([language, kind, expected]) => {
    expect(shown(language === 'Python' ? NoopMutation : NoopMutationNative, kind)).toBe(expected);
});

// Telling a call that may add and remove both, `symmetric_difference_update`,
// costs nothing per member: the set was copied before each call and compared
// after, and a set filled one call at a time cost the square of its size. The
// bound is absolute and generous, as in `row-updates-linear.test.js`.
test('toggling 10,000 members of a set one call at a time is linear', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(SymmetricFill, { target });
    flushSync();

    const started = performance.now();
    target.querySelector('button').click();
    flushSync();
    const spent = performance.now() - started;

    expect(target.querySelector('p').textContent).toBe('10000');
    expect(spent).toBeLessThan(1000);
});

// The page shows what the model holds after each write, the witness being the
// model itself: a `SvelteMap` holds `1` and `1.0` as one number.
test.for(['float for int', 'int for float', 'negative zero', 'update float for int', 'mixed float for int'])(
    'a write of %s, the same number to JavaScript, repaints',
    (kind) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(TypedWrite, { target });
        flushSync();

        flushSync(() => instance.write(kind));

        expect(target.querySelector('output').textContent).toBe(instance.model());
        expect(target.querySelector('output').textContent).not.toBe('1 2.0 0.0 1');
    }
);
