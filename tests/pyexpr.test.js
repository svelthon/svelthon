import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import PyExpr from './fixtures/PyExpr.svelte';
import Shorthand from './fixtures/Shorthand.svelte';
import JsImport from './fixtures/JsImport.svelte';

// Template expressions are compiled as Python, not left to the JavaScript
// parser. Every site becomes a hidden Python function the markup calls, block
// variables passed as arguments — so dependencies are discovered on their own,
// exactly as they are for @derived.
describe('Python expressions in the template', () => {
    const cell = (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(PyExpr, { target });
        flushSync();
        return target.querySelector(`[data-k="${k}"]`).textContent;
    };

    test('Python operators', () => {
        expect(cell('is')).toBe('True'); // `is None`, not `=== null`
        expect(cell('and')).toBe('True'); // `and`, not `&&`
        expect(cell('not')).toBe('False'); // `not`, not `!`
        expect(cell('ternary')).toBe('yes'); // `a if c else b`
    });

    test('builtins and sequence syntax', () => {
        expect(cell('len')).toBe('3'); // len(), not .length
        expect(cell('slice')).toBe("['b', 'c']"); // a Python slice
        expect(cell('subscript')).toBe('1'); // dict by key
        expect(cell('comprehension')).toBe("['A', 'B', 'C']");
    });

    test('f-strings', () => {
        expect(cell('fstring')).toBe('3 items');
    });

    test('instance attributes', () => {
        // Brython keeps them out of the object's JS properties, so a template
        // reads them through Python's own attribute protocol.
        expect(cell('attr')).toBe('[x:X][y:Y]');
    });

    test('conditions follow Python truthiness', () => {
        expect(cell('if')).toBe('false'); // None is false, a full list is true
    });
});

// The markup has corners that are not interpolations, and they must go through
// Python like the rest: an HTML comment must not derail the scanner, and both
// shorthand and spread must read through the accessor.
describe('markup corners', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Shorthand, { target });
        flushSync();

        return {
            el: (k) => target.querySelector(`[data-k="${k}"]`),
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('an apostrophe in a comment does not break compilation below it', () => {
        // Without the fix, the scanner opened a string that was never closed
        // and the whole rest of the template stayed JavaScript, silently: this
        // empty list would have rendered through String([]), so as nothing.
        expect(setup().el('text').textContent).toBe('[]');
    });

    test('an interpolation inside a quoted attribute is Python', () => {
        const { el } = setup();

        // `class="tag {word.lower()}"` — without the fix, the scanner skipped
        // everything between quotes and `.lower()` went to the JavaScript
        // parser, where it does not exist.
        expect(el('cite').getAttribute('class')).toContain('tag active');
        expect(el('cite').getAttribute('title')).toBe('n=0');
    });

    test('a {name} shorthand passes an in-place mutation to the child', () => {
        const { el, click } = setup();

        expect(el('child').textContent).toBe('[]');
        click('mutate_rows');

        // Svelte compiles a dynamic prop into a derived, which memoises on
        // `===`: follow() is what reconnects the child to the object itself.
        expect(el('parent').textContent).toBe("['x']");
        expect(el('child').textContent).toBe("['x']");
    });

});

// A Python component imports no JavaScript — but its `<script module>` does, and
// those names are in scope for the generated code. Publishing them into the
// namespace is what lets Python reach `page` from $app/state, or any npm
// library at all.
describe('<script module> imports are readable from Python', () => {
    const el = (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(JsImport, { target });
        flushSync();
        return target.querySelector(`[data-k="${k}"]`).textContent;
    };

    test('a constant declared over there', () => {
        expect(el('direct')).toBe('came from JavaScript');
    });

    test('and it travels through a @derived', () => {
        expect(el('derived')).toBe('CAME FROM JAVASCRIPT');
    });

    test('an imported function', () => {
        expect(el('function')).toBe('yes');
    });

    test('a star import', () => {
        expect(el('star')).toBe('yes');
    });
});
