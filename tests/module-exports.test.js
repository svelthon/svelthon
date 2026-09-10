// @vitest-environment node
//
// `__all__` is Python's own way for a module to say what it exports, and the
// closest thing the language has to an `export` keyword. Svelthon reads it off
// the AST, which is what keeps it an ordinary assignment rather than a keyword.
//
// Two things were wrong with it, one per file kind, and they are the same seam:
// the module paths never learned what the component path learned about binding
// forms.
//
// In a `.py`, the export read a *JavaScript* binding, and only the reactive
// names have one. `__all__ = ["Widget"]` on a class emitted
// `pyExport(Widget, …)` for a `Widget` that was never declared, so the module
// failed to evaluate with `ReferenceError` and took every other export with it.
//
// In a `.svelte.py`, `__all__` was not read at all: the store published every
// name it had, and published `__all__` itself as reactive state, with a revision
// signal, a bump and a read behind it.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const plain = (src) => compile(src, 'M', 'src/m.py', { plain: true }).script;
const store = (src) => compile(src, 'S', 'src/s.svelte.py', { store: true }).script;

describe('a .py exports what __all__ names, whatever bound it', () => {
    const MODULE = `__all__ = ["Widget", "LIMIT", "make", "brought"]

from calendrier import date as brought

LIMIT = 10


class Widget:
    pass


def make():
    return Widget()


hidden = 1
`;

    // The repair: read the value off the namespace, where the module body put
    // every one of them, rather than off a binding only some of them have.
    test.for([['Widget'], ['LIMIT'], ['brought']])('%s is read from the namespace', ([name]) => {
        expect(plain(MODULE)).toContain(`const __export_${name} = pyExport(__py.${name},`);
    });

    test('and none of them references a bare name that was never declared', () => {
        const script = plain(MODULE);

        for (const name of ['Widget', 'LIMIT', 'brought']) {
            expect(script).not.toContain(`pyExport(${name},`);
        }
    });

    // A function keeps the wrapper the plain path declares for it, so it is
    // exported under its own name while a value is exported through `__export_`.
    test('a function is still exported as itself', () => {
        expect(plain(MODULE)).toContain(
            'export { __export_Widget as Widget, __export_LIMIT as LIMIT, make, __export_brought as brought };'
        );
    });

    test('and a name outside __all__ is not exported at all', () => {
        expect(plain(MODULE)).not.toContain('hidden as hidden');
        expect(plain(MODULE)).not.toContain('__export_hidden');
    });

    // Reading off the namespace would have turned a typo into `undefined`, which
    // is quieter than the ReferenceError it replaces. So it is refused instead.
    test('a name __all__ invents is refused, and named', () => {
        expect(() => plain('__all__ = ["Nope"]\n\nx = 1\n')).toThrow(
            /`__all__` names `Nope`, which this module never binds \(src\/m\.py\)/
        );
    });

    test.for([['class Nope:\n    pass'], ['import Nope'], ['for Nope in [1]:\n    pass']])(
        'while %s satisfies it',
        ([form]) => {
            expect(() => plain(`__all__ = ["Nope"]\n\n${form}\n`)).not.toThrow();
        }
    );
});

describe('a .svelte.py publishes what __all__ names', () => {
    const MODULE = `__all__ = ["count", "bump"]

count = 0
hidden = 99


def bump():
    global count
    count = count + 1


def unlisted():
    return 1
`;

    test('the listed state is on the store', () => {
        expect(store(MODULE)).toContain('get count()');
    });

    test('and the unlisted state is not', () => {
        expect(store(MODULE)).not.toContain('get hidden()');
    });

    test('the listed function is on it, and exported by name', () => {
        const script = store(MODULE);

        expect(script).toContain('    bump,');
        expect(script).toContain('export { bump };');
    });

    test('and the unlisted function is neither', () => {
        expect(store(MODULE)).not.toContain('    unlisted,');
        expect(store(MODULE)).not.toContain('unlisted };');
    });

    // A module that says nothing exports everything, which is what every store
    // in the project relies on.
    test('a module with no __all__ still publishes all of it', () => {
        const script = store('count = 0\nhidden = 99\n\n\ndef bump():\n    pass\n');

        expect(script).toContain('get count()');
        expect(script).toContain('get hidden()');
        expect(script).toContain('export { bump };');
    });
});

// `__all__` and `__js__` are read off the AST and read is all they are for.
// Leaving them in the buckets made them module state, so a store published
// `store.__all__` with a signal behind it: generated machinery for a compiler
// directive, and a name that is not data given a reactive getter and a setter.
describe('a directive is not data', () => {
    test.for([['__all__ = ["x"]\n\nx = 1\n'], ['__js__ = {"@sveltejs/kit": ["error"]}\n\nx = 1\n']])(
        'it gets no signal, no revision and no accessor',
        ([src]) => {
            const script = store(src);

            expect(script).not.toMatch(/let __(all|js)__ = \$state\.raw/);
            expect(script).not.toMatch(/__rev___(all|js)__/);
            expect(script).not.toMatch(/bind\(__proto, '__(all|js)__'/);
        }
    );

    test('and it is not a member of the store', () => {
        expect(store('__all__ = ["x"]\n\nx = 1\n')).not.toContain('get __all__()');
    });

    test('while still being read: the export it declares is honoured', () => {
        expect(store('__all__ = ["x"]\n\nx = 1\ny = 2\n')).not.toContain('get y()');
    });

    test('and on the plain path too', () => {
        expect(plain('__js__ = {"@sveltejs/kit": ["error"]}\n\nx = 1\n')).not.toContain(
            "bind(__proto, '__js__'"
        );
    });
});
