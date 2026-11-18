// **An item or an attribute written the value it holds tells nobody**, as an
// item of Svelte's `$state` array and a `$state` field of a class tell nobody
// of a value `===` to the one they hold. An effect writing back what it read,
// `rows[0] = rows[0]` or `box.x = round(box.x, 2)`, ran for ever: a list's item
// and an attribute told their readers whatever they wrote, an int written over
// itself among them, where a dict's key compared already.
//
// A write Svelte refuses, in a derived, is refused whatever it writes. And an
// instance whose class writes its attributes itself, by a `__setattr__` of its
// own, may store a value anywhere: its write is told unless Python's lookup
// finds the attribute unchanged before and after it, as a setter of Svelte's
// normalising into its state tells nobody of the value it holds already.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SameItemWrite from './fixtures/SameItemWrite.svelte';
import SameItemWriteNative from './fixtures/SameItemWriteNative.svelte';
import SameItemStored from './fixtures/SameItemStored.svelte';

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
        ['item', 'item same', 'item from the end', 'attribute', 'attribute same', 'own attribute', 'own property', 'own slot', 'own dict'].map(
            (kind) => [language, kind]
        )
    )
)('%s: an effect writing an %s back runs once a change', ([language, kind]) => {
    const Component = language === 'Python' ? SameItemWrite : SameItemWriteNative;

    expect(runs(Component, { kind })).toBe('1 2 2.5 2.5 10');
});

test.for(
    ['Python', 'Svelte'].flatMap((language) => ['derived item', 'derived attribute'].map((kind) => [language, kind]))
)('%s: the same value written in a derived, as a %s, is refused', ([language, kind]) => {
    const Component = language === 'Python' ? SameItemWrite : SameItemWriteNative;

    expect(runs(Component, { kind })).toBe('refused');
});

test('an attribute a class writes itself is told when written', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(SameItemStored, { target });

    flushSync();
    expect(target.textContent).toBe('1.5');
    instance.change();
    flushSync();
    expect(target.textContent).toBe('2.5');
});
