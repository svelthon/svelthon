// The scanner's Python is smaller than the compiler's.
//
// Finding where a `{…}` expression ends is string work: walk to the matching
// brace, ignoring the ones inside string literals. It knew ordinary quotes and
// nothing else, so two shapes of valid Python cut the expression at the wrong
// place — a `}` inside a **comment**, and a `}` inside a **triple-quoted**
// string holding a lone quote. What reached the compiler was a fragment, and the
// error named truncated code rather than the author's expression.
//
// The ordinary string is the witness: that protection already existed, and the
// repair must not be a special case for `}`.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import LexicalExpressions from './fixtures/LexicalExpressions.svelte';

describe('an expression whose brace is not a brace', () => {
    const read = (key) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(LexicalExpressions, { target });
        flushSync();

        return target.querySelector(`[data-k="${key}"]`).textContent;
    };

    test('a comment holding one is still one expression', () => {
        expect(read('commented')).toBe('3');
    });

    test('and so is a triple-quoted string holding one', () => {
        expect(read('tripled')).toBe('a " } b');
    });

    // An f-string is two grammars in one literal, and since Python 3.12 the code
    // in a field may reuse the delimiter of the string holding it.
    test('an f-string field may reuse the delimiter around it', () => {
        expect(read('reused')).toBe('}');
    });

    test('and alternating delimiters keep working', () => {
        expect(read('alternating')).toBe('}');
    });

    test('while an ordinary string was already safe', () => {
        expect(read('quoted')).toBe('a } b');
    });
});
