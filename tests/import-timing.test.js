// A project module's body runs at the `import` that names it, and not when the
// importer's code is evaluated. Its code is evaluated in front of the
// importer, so it is at hand; it ran there too, so an import under an `if` not
// taken or in a function never called ran it all the same, its effects came
// before the importer's, and its exception was raised outside the `try` meant
// to catch it. CPython answers each line below.
import { test, expect } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import { recorded } from './fixtures/timing_log.py';
import { later, again } from './fixtures/timing_imports.py';
import { store } from './fixtures/timing_store.svelte.py';
import TimingImport from './fixtures/TimingImport.svelte';

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
