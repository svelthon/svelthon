import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import ImportJs from './fixtures/ImportJs.svelte';
import Lines from './fixtures/ImportJsLines.svelte';

// A component's JavaScript, declared where its Python is. `__js__` covers a
// plain `.py` and only the named form, which is all a module ever asks for; a
// component asks for three more, and every one of them is a template concern —
// the default export of a `.svelte` child, a stylesheet imported for its effect,
// and a namespace for `<Dialog.Root>`.
describe('importjs', () => {
    const setup = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`)?.textContent;
    };

    // The commonest import in the whole codebase, and the one no declaration
    // read from the AST could express: a `.svelte` exports its component as the
    // default, which `from x import y` cannot reach.
    test('a default import, used as a component in the markup', () => {
        expect(setup(ImportJs)('child')).toBe('parent → child');
    });

    test('a named import, renamed on the way in, and readable from Python', () => {
        expect(setup(ImportJs)('named')).toBe('yes');
    });

    test('a namespace import, whose members Python reaches through the dot', () => {
        expect(setup(ImportJs)('namespace')).toBe('yes');
    });

    // The default and some names, from one module — JavaScript's own clause
    // allows it, and a component that imports a child *and* something its
    // `<script module>` exports needs exactly this shape.
    test('a default and named imports, from the same module', () => {
        expect(setup(ImportJs)('mixed-child')).toBe('from the module script');
    });

    // Nothing to assert but the absence of a crash: a stylesheet has no value.
    // That it renders at all is the test — the import has to reach the generated
    // module without leaving anything behind in the Python.
    test('an import for its effect alone', () => {
        expect(setup(ImportJs)('child')).toBe('parent → child');
    });

    // The statement leaves its line blank rather than being removed, because the
    // source map is line-level: a line-preserving pass costs the tracebacks
    // nothing, and a removed line would move every number under it.
    test('the lines below an importjs keep their own numbers', () => {
        setup(Lines);

        // A handler's throw escapes the DOM dispatch rather than the call, so it
        // arrives as an error event, not as an exception here.
        let reported;
        const catcher = (event) => {
            reported = event.error ? event.error.message : event.message;
            event.preventDefault();
        };

        window.addEventListener('error', catcher);
        document.querySelector('button[data-k="boom"]').click();
        flushSync();
        window.removeEventListener('error', catcher);

        expect(reported).toMatch(/ImportJsLines\.svelte:6/);
    });
});
