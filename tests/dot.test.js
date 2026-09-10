import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DotFallback from './fixtures/DotFallback.svelte';
import DotMissing from './fixtures/DotMissing.svelte';

// `{pep.title}` on a dict. A template expression already differs from the same
// text in the script — `{#if}` goes through `__truthy`, an interpolation through
// `__text` — and the dot now joins them, finding an attribute first and a key
// second, which is what Jinja does and what anyone coming from Django expects.
describe('the dot in a template expression', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DotFallback, { target });
        flushSync();
        return (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    test('reads a key off a dict', () => {
        expect(setup()('dict')).toBe('Making the GIL Optional');
    });

    test('both spellings still mean the same thing', () => {
        expect(setup()('both')).toBe('Making the GIL Optional / Making the GIL Optional');
    });

    test('it nests', () => {
        expect(setup()('nested')).toBe('Sam Gross');
    });

    test('an object is untouched', () => {
        expect(setup()('object')).toBe('Style Guide for Python Code');
    });

    test('a real attribute wins over a key of the same name', () => {
        // `{d.items}` is the method — a dict's own — not the key called "items".
        // That is Jinja's order, and it is why the subscript keeps its purpose.
        expect(setup()('attribute-wins')).toBe('builtin_method');
        expect(setup()('key-by-subscript')).toBe('a key called items');
    });

    test('a name that is neither raises rather than rendering nothing', () => {
        const target = document.body.appendChild(document.createElement('div'));
        expect(() => {
            mount(DotMissing, { target });
            flushSync();
        }).toThrow(/absent/);
    });
});

// Where the seam falls, pinned rather than assumed: the fallback lasts for the
// length of the expression, so a helper called *from* the markup gets it too,
// and the same helper called from a lifecycle hook does not.
describe('the reach of the fallback', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DotFallback, { target });
        flushSync();
        return (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    test('a helper called from the markup sees it', () => {
        expect(setup()('through-call')).toBe('Making the GIL Optional');
    });

    test('the same helper called from on_mount does not', () => {
        expect(setup()('from-mount')).toBe('AttributeError');
    });
});
