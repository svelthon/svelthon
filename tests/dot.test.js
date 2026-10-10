import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import DotFallback from './fixtures/DotFallback.svelte';
import DotMissing from './fixtures/DotMissing.svelte';
import DotHiddenGetitem from './fixtures/DotHiddenGetitem.svelte';

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

    // Whether there is a key to read is asked as `obj["answer"]` asks it, of the
    // class's MRO, and never of the metaclass's `__getattribute__`, which hid
    // the method or raised and left the read with no key. The write a binding
    // makes asks the same question.
    test('a key is found as the subscript finds it, whatever the metaclass', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DotHiddenGetitem, { target });
        flushSync();
        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

        expect([read('hidden'), read('raising')]).toEqual(['42', '42']);

        const input = target.querySelector('input[data-k="write"]');
        input.value = '7';
        input.dispatchEvent(new Event('input'));
        flushSync();

        expect(read('held')).toBe('7');
    });

    test('a name that is neither raises rather than rendering nothing', () => {
        const target = document.body.appendChild(document.createElement('div'));
        expect(() => {
            mount(DotMissing, { target });
            flushSync();
        }).toThrow(/absent/);
    });
});

// Where the seam falls: the rule belongs to the **text** of the markup, not to
// the time during which an expression runs. A function of the script keeps plain
// Python wherever it is called from, and a lambda written in the markup keeps
// the rule wherever it runs, a click's handler included.
describe('the reach of the fallback', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DotFallback, { target });
        flushSync();
        return {
            read: (k) => target.querySelector(`p[data-k="${k}"]`).textContent,
            click: (k) => {
                target.querySelector(`button[data-k="${k}"]`).click();
                flushSync();
            }
        };
    };

    test('a function of the script called from the markup does not get it', () => {
        expect(setup().read('through-call')).toBe('AttributeError');
    });

    test('and answers as it does when the script calls it', () => {
        expect(setup().read('from-mount')).toBe('AttributeError');
    });

    test('a lambda written in the markup gets it while the markup runs', () => {
        expect(setup().read('in-lambda')).toBe('Making the GIL Optional');
    });

    test('and keeps it when it runs later, as a handler', () => {
        const { read, click } = setup();

        click('click');
        expect(read('clicked')).toBe('Making the GIL Optional');
    });
});
