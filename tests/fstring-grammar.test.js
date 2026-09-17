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

// A backslash before the brace that opens a field.
//
// The scanner hid the character after a backslash so that `"\""` stays one
// string, and a brace cannot be hidden that way: the escape for a brace is
// `{{`, and Python leaves the backslash in the text while the field opens all
// the same. So the `{` was skipped, the quote inside the field read as the end
// of the string, and the expression cut in half — the template kept the first
// half and handed Svelte the rest as markup, where the whole component then
// failed to compile.
//
// The expected values are CPython 3.14's, measured on the same three lines.
describe('a backslash in an f-string', () => {
    const read = (key) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(FstringGrammar, { target });
        flushSync();

        return target.querySelector(`[data-k="${key}"]`).textContent;
    };

    test('does not hide the brace that opens a field', () => {
        expect(read('raw-escaped')).toBe('\\}');
    });

    test('and the same line without it is unchanged', () => {
        expect(read('raw-plain')).toBe('}');
    });

    test('while it still hides what it can hide', () => {
        expect(read('escaped-pair')).toBe('\\3');
    });
});
