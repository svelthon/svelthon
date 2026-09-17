// Which colon opens a format specification.
//
// A field's `:` starts one; a dict's does not, and neither does a slice's. The
// scanner told them apart by counting parentheses and brackets, which says
// nothing about braces: `f"{ {'x': '}'} }"` set the specification state on the
// dict's colon, and inside that state a quote no longer protects what it holds,
// so the brace in `'}'` was read as a closing one.
//
// The witness is the same expression with a number instead of the string, which
// compiled throughout.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import FstringGrammar from './fixtures/FstringGrammar.svelte';

describe('a colon inside an f-string field', () => {
    const read = (key) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(FstringGrammar, { target });
        flushSync();

        return target.querySelector(`[data-k="${key}"]`).textContent;
    };

    test('belongs to the dict that holds it, even when a value holds a brace', () => {
        expect(read('dict-string')).toBe("{'x': '}'}");
    });

    test('as it already did for a number', () => {
        expect(read('dict-number')).toBe("{'x': 1}");
    });

    // And a real specification still works, width computed from an expression
    // that itself holds a brace.
    test('while a field’s colon still opens a specification', () => {
        expect(read('computed')).toBe('3');
    });

    test('and a slice keeps its own', () => {
        expect(read('slice')).toBe('[1, 2]');
    });
});
