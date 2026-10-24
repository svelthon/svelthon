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
import RuneWalrus from './fixtures/RuneWalrus.svelte';
import DerivedSharedLines from './fixtures/DerivedSharedLines.svelte';
import DerivedImportingDecorator from './fixtures/DerivedImportingDecorator.svelte';
import DerivedSharedLinesNative from './fixtures/DerivedSharedLinesNative.svelte';
import EffectNameWrites from './fixtures/EffectNameWrites.svelte';
import store from './fixtures/derived_writes.svelte.py';
import { held, write, bump } from './fixtures/derived_writes_plain.py';

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

// A `:=` of the name inside its own declaration is valid Python, and the
// declaration's binding writes over it: the body is the last write on the
// declaration's lines. Taken for the first one, the `:=` was installed as the
// body, `TypeError: 'int' object is not callable`, in a default, a decorator's
// argument or the marker's, for an effect as for a derived.
test('a := of the name inside its declaration is written over by the declaration, as Python’s is', () => {
    const seen = [];
    const { instance, shown } = mounted(RuneWalrus, { notify: (one) => seen.push(one) });
    const trace = [instance.held(), shown()];

    instance.bump();
    flushSync();
    trace.push(instance.held(), shown());

    expect(trace).toEqual(['2 3 4 4', '2 3 4 4', '4 6 8 8', '4 6 8 8']);
    expect(seen.toSorted()).toEqual(['early 1', 'early 2', 'watched 1', 'watched 2']);
});

// A declaration sharing its line with another statement is Python, and so is a
// read of the name between a `:=` and the binding: the binding is the write
// after the declaration's marker ran, and what a statement after it writes is
// Svelte's write to its derived. Told by the line alone, both were refused.
test('a declaration sharing its line, and a read before its binding, run as Python and Svelte run them', () => {
    const trace = (Component) => {
        const { instance, shown } = mounted(Component);
        const seen = [instance.held(), shown()];

        instance.bump();
        flushSync();
        seen.push(instance.held(), shown());
        return seen;
    };

    expect(trace(DerivedSharedLinesNative)).toEqual(['2 1 1 99 9', '2 1 1 99 9', '4 1 1 6 13', '4 1 1 6 13']);
    expect(trace(DerivedSharedLines)).toEqual(trace(DerivedSharedLinesNative));
});

// The mark of a declaration is its namespace's: one mark for the page was
// replaced by the markers of a store a decorator above `@derived` imported,
// and the binding taken for a write before it, the function held as a value.
test('a decorator importing a store with runes leaves the declaration its binding', () => {
    const { instance, shown } = mounted(DerivedImportingDecorator);
    const seen = [instance.held(), shown()];

    instance.bump();
    flushSync();
    seen.push(instance.held(), shown());
    expect(seen).toEqual(['2 3', '2', '4 3', '4']);
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
