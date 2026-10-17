// A project module's body runs at the `import` that names it, and not when the
// importer's code is evaluated. Its code is evaluated in front of the
// importer, so it is at hand; it ran there too, so an import under an `if` not
// taken or in a function never called ran it all the same, its effects came
// before the importer's, and its exception was raised outside the `try` meant
// to catch it. CPython answers each line below.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { recorded } from './fixtures/timing_log.py';
import { later, again, retried, kept, computed, read_kept } from './fixtures/timing_imports.py';
import { store } from './fixtures/timing_store.svelte.py';
import TimingImport from './fixtures/TimingImport.svelte';
import TimingLate from './fixtures/TimingLate.svelte';
import { early, late } from './fixtures/cycle_a.py';
import { seen, refused, now } from './fixtures/cycle_b.py';

test('a module runs at its import, after what comes before it, and raises into its except', () => {
    expect(recorded()).toBe('before first after fails caught');
});

test('a module imported in a function runs when the function does, once', () => {
    expect(later()).toBe(7);
    expect(later()).toBe(7);
    expect(recorded()).toBe('before first after fails caught later');
});

test('a module whose body raised runs again at the next import', () => {
    again();
    expect(recorded()).toBe('before first after fails caught later fails caught again');
});

// And in a new module: a name the failed attempt bound is not there, in a
// module or a reactive module. The failed one, which held on to itself, is
// another object, keeps what it bound and nothing the next one binds, and is
// written on alone.
test('a module whose body raised runs again in a new module', () => {
    expect(retried()).toEqual([
        ['failed', true, true],
        ['failed', true, true]
    ]);
    expect(kept()).toEqual([
        [false, true, false, true],
        [false, true, false, true]
    ]);
});

// A derived nobody read is never run: not by what the failure keeps of the
// module, and not by the watch that reaches the module, `timing_log` imported
// into a reactive module holding a list of modules.
test('a derived of a failed or watched module is never run unread', () => {
    expect(computed()).toBe(0);
});

// And what the failed module keeps reads as it did: a derived is computed
// when read, from its own names, and its functions find the helpers the
// compiler lends it.
test('a failed module still reads its derived and calls its helpers', () => {
    expect(read_kept()).toEqual([
        [20, 40, 'hello-world'],
        [20, 40, 'hello-world']
    ]);
});

test('an import in a branch not taken runs nothing, in a module, a reactive module or a component', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TimingImport, { target });

    flushSync();
    expect(target.textContent).toBe('ok');
    expect(store.count).toBe(0);
    expect(recorded()).not.toContain('never');

    unmount(instance);
    target.remove();
});

// A reactive module first imported while the page reads, by a `@derived` or a
// function the template calls: its body binds its names outside that reaction,
// and what the page reads of it afterwards is followed.
test('a reactive module first imported while the page reads binds its names, and is followed', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(TimingLate, { target });

    flushSync();
    expect(target.textContent).toBe('7 7');

    instance.bump();
    flushSync();
    expect(target.textContent).toBe('8 8');

    unmount(instance);
    target.remove();
});

// The module is published before its body runs, so a cycle finds it half made:
// what it bound before the import that closes the cycle, and not what it binds
// after, which `from … import` refuses and a later read finds.
test('an import cycle finds the module half made', () => {
    expect([early, late]).toEqual(['early', 'late']);
    expect([seen, refused, now()]).toEqual(['early', 'ImportError', 'late']);
});

// Where this departs from CPython, written: a module named `remote.py` or
// `*.remote.py` is one SvelteKit takes for a module of remote functions by its
// name, and refuses the half an import runs, so it has one, whether SvelteKit
// builds the page or not. Its body runs as it loads, when its importer's code
// is evaluated, and not at the import statement; `timing_never`, imported the
// same way, still runs nothing. Imported here, last: what it records comes
// after every line the tests above read.
test('a module named remote.py runs its body as it loads, under an import not taken', async () => {
    await import('./fixtures/timing_remote.py');

    expect(recorded()).toMatch(/ remote$/);
    expect(recorded()).not.toContain('never');
});
