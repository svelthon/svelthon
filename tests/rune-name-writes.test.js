// **A write to a rune's name is the name's, unless it is the declaration's.**
// The declaration, the statement carrying `@derived`, `derived(…)`, `=>` or
// `@effect`, installs the body; every other write, by `=` or `del`, from the
// script, a function or a parent's store access, is a value. A derived holds
// it as Svelte's `doubled = 99` holds it for `let doubled = $derived(…)`, until
// what its body read changes; with no body to come back to, a name `del`
// removed or a plain module's, it holds it for good. An effect keeps running
// the body it was declared with, as Python keeps the function a decorator
// registered.
//
// The setter wrote every value as the body: `doubled = 99` was called at the
// next read, `TypeError: 'int' object is not callable`, and an effect whose
// name was bound again raised at its next run.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import DerivedWrites from './fixtures/DerivedWrites.svelte';
import DerivedWritesNative from './fixtures/DerivedWritesNative.svelte';
import DerivedDrops from './fixtures/DerivedDrops.svelte';
import DerivedDeclarations from './fixtures/DerivedDeclarations.svelte';
import DerivedDeclarationsNative from './fixtures/DerivedDeclarationsNative.svelte';
import DerivedDeclarationFails from './fixtures/DerivedDeclarationFails.svelte';
import EffectNameWrites from './fixtures/EffectNameWrites.svelte';
import store from './fixtures/derived_writes.svelte.py';
import { held, write, bump } from './fixtures/derived_writes_plain.py';
import { compile } from '../src/lib/compile.js';

const mounted = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    flushSync();
    return { instance, shown: () => target.querySelector('[data-k="shown"]')?.textContent };
};

test('a derived written holds the value, until what its body read changes, as Svelte’s does', () => {
    const trace = (Component) => {
        const { instance, shown } = mounted(Component);
        const seen = [instance.held()];

        instance.write(99);
        flushSync();
        seen.push(instance.held(), shown());
        instance.bump();
        flushSync();
        seen.push(instance.held(), shown());
        return seen;
    };

    expect(trace(DerivedWritesNative)).toEqual(['2 3 4', '99 99 99', '99 99 99', '4 6 8', '4 6 8']);
    expect(trace(DerivedWrites)).toEqual(trace(DerivedWritesNative));
});

test('a derived written a function holds it, uncalled', () => {
    const { instance } = mounted(DerivedWrites);

    expect(instance.write_function()).toBe('held held held');
    instance.bump();
    flushSync();
    expect(instance.held()).toBe('4 6 8');
});

test('a derived deleted, then written, holds the value for good', () => {
    const { instance } = mounted(DerivedDrops);

    expect(instance.drop()).toBe('NameError NameError NameError False False False');
    expect(instance.write(7)).toBe('7 7 7 True True True');
    expect(instance.bump()).toBe('7 7 7 True True True');
});

test('a derived of a store written holds the value, until what its body read changes', () => {
    expect(store.held()).toBe('3 4');
    store.write(99);
    expect([store.held(), store.decorated, store.called]).toEqual(['99 99', 99, 99]);
    store.bump();
    expect([store.held(), store.decorated, store.called]).toEqual(['6 8', 6, 8]);
});

test('a derived of a plain module written holds the value for good', () => {
    expect(held()).toBe(2);
    write(99);
    expect(held()).toBe(99);
    bump();
    expect(held()).toBe(99);
});

// The declaration is what the module's own code writes to the name on the
// statement's lines, the last of it its binding. Told by a flag the marker
// raised, the next write of any rune name took it: a decorator above
// `@derived` writing another derived, the second target of `first = second =
// derived(…)` left the lambda, and a decorator that raised left the flag for
// the next write anywhere. Told by the first write there, a write the
// statement made before its binding was taken for the body.
test('a declaration is told from a decorator’s write, a second target and a write before its binding, as Svelte’s', () => {
    const trace = (Component) => {
        const { instance, shown } = mounted(Component);
        const seen = [instance.held(), shown()];

        instance.bump();
        flushSync();
        seen.push(instance.held(), shown());
        return seen;
    };

    expect(trace(DerivedDeclarationsNative)).toEqual(['99 2 3 3 4', '99 2 3 3 4', '20 4 6 6 8', '20 4 6 6 8']);
    expect(trace(DerivedDeclarations)).toEqual(trace(DerivedDeclarationsNative));
});

// What the module writes on a declaration's lines is the declaration's, so a
// declaration stands on lines of its own, and binds its name once: another
// statement there would be read as the declaration, and a `:=` of the name
// inside it, which the declaration binds again at once, was installed as the
// body, `TypeError: 'int' object is not callable`, in a default, a decorator's
// argument or the marker's, for an effect as for a derived.
const BUILD = 'def build(value):\n    return lambda: 1\n\n';

test.for([
    ['a second statement after it', 'd = derived(lambda: 1); d = 99\n', /shares with another statement/],
    ['a statement before it', 'x = 1; d = derived(lambda: x)\n', /shares with another statement/],
    ['a := in a default', '@derived\ndef d(ignored=(d := 99)):\n    return 1\n', /binds the name inside its own declaration/],
    ['a := in a decorator', `${BUILD}@build(d := 99)\n@derived\ndef d():\n    return 1\n`, /binds the name inside/],
    ['a := in the marker’s argument', `${BUILD}d = derived(build(d := 99))\n`, /binds the name inside/],
    ['a := in a comprehension', `${BUILD}d = derived(build([d := 1 for _ in [0]]))\n`, /binds the name inside/],
    ['a := in an effect’s default', '@effect\ndef w(ignored=(w := 99)):\n    pass\n', /binds the name inside/],
    ['a := in an effect.pre’s default', '@effect.pre\ndef w(ignored=(w := 99)):\n    pass\n', /binds the name inside/]
])('a declaration with %s is refused', ([, source, said]) => {
    expect(() => compile(source, 'S', 'src/S.svelte')).toThrow(said);
});

test('a := inside the body a declaration hands over binds the body’s own name, and is no write of the declaration', () => {
    expect(() => compile('d = derived(lambda: (d := 5))\n', 'S', 'src/S.svelte')).not.toThrow();
});

test('a declaration that fails leaves the next write elsewhere a value', () => {
    const target = document.body.appendChild(document.createElement('div'));

    expect(() => mount(DerivedDeclarationFails, { target })).toThrow();
    write(5);
    expect(held()).toBe(5);
});

test.for(['rename', 'drop'])('an effect whose name a function binds again by %s runs its body', (operation) => {
    const seen = [];
    const { instance } = mounted(EffectNameWrites, { notify: (one) => seen.push(one) });

    expect(instance[operation]()).toBe(operation === 'rename' ? '5 5 5' : 'False False False');
    flushSync();
    seen.length = 0;
    instance.bump();
    flushSync();
    expect(seen.toSorted()).toEqual(['early 2', 'rooted 2', 'watch 2']);

    // And the root's destructor, read before, still ends it.
    instance.stop();
    seen.length = 0;
    instance.bump();
    flushSync();
    expect(seen.toSorted()).toEqual(['early 3', 'watch 3']);
    unmount(instance);
});
