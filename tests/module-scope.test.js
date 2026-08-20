import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import ModuleScope from './fixtures/ModuleScope.svelte';

// Names declared by a `<script module>` are published so Python can read them.
// The scan used to accept a declaration at any indentation, so a `const` inside a
// function body was published too — and the component then bound a name that
// exists nowhere, which is a ReferenceError at render.
describe('<script module> declarations', () => {
    const el = (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(ModuleScope, { target });
        flushSync();
        return target.querySelector(`[data-k="${k}"]`).textContent;
    };

    test('a top-level constant is readable from Python', () => {
        expect(el('label')).toBe('top level');
    });

    test('and a function it declares is callable', () => {
        expect(el('helper')).toBe('inside a function1');
    });
});
