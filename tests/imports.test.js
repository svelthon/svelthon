import { test, expect, describe } from 'vitest';
import { mount, flushSync } from 'svelte';
import FromImport from './fixtures/FromImport.svelte';

// Two things had to be true for `from x import y` to work in a component, and
// neither was.
//
// The standard library a component uses is bundled from Brython's own build-time
// VFS, and the list of modules to bundle came from the compiler's `root.imports`
// — which records `import x` and nothing else. So `from fractions import
// Fraction` compiled cleanly and then failed in the browser, on a module the
// bundle had never been given.
//
// And `$import_from` reads the importing module's name to work out what package
// it sits in. Every namespace Brython builds carries one; the namespace Svelthon
// substitutes did not, so the lookup asked for a module called `undefined` — in
// a component where `import x` on the line above had just worked.
describe('from x import y', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(FromImport, { target });
        flushSync();
        return (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    test('a name imported from a JavaScript stdlib module', () => {
        expect(setup()('floor')).toBe('3');
    });

    test('a name imported from a Python stdlib module, and its dependencies', () => {
        // fractions is Python, and pulls in numbers, decimal and the rest —
        // the whole transitive closure has to travel with the component.
        expect(setup()('third')).toBe('1/2');
    });

    test('the plain import beside it still works', () => {
        expect(setup()('tau')).toBe('6.2832');
    });

    // `itertools.batched` is Jinja's `|batch`, and Python's own since 3.12 —
    // which is why Svelthon injects no helper for it. Documented in DJANGO.md.
    test('an iterator from the stdlib feeds an {#each} directly', () => {
        const read = setup();
        expect([read('chunk-0'), read('chunk-1')]).toEqual(['abc', 'de']);
    });
});
