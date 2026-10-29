// **A name of the `<script module>` is read off that script's own scope**: the
// instance script is a scope inside it, where the compiler declares names of
// its own, `__rev_value__` beside a Python `value__`, and a bare read of the
// module's `__rev_value__` found the instance's: `0`, with no error. Read
// through getters laid down in the module script, as it holds now.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ModuleShadowed from './fixtures/ModuleShadowed.svelte';

test("a module's name is read as the module holds it, beside a name the compiler builds", () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ModuleShadowed, { target });
    flushSync();

    expect([target.textContent, instance.read()]).toEqual(['41', 42]);
});
