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
        expect(plain(MODULE)).toContain(`const __export_${name} = __pyExport(__py.${name},`);
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

// `__all__` is an ordinary Python name, and the value that counts is the one it
// holds when the module has finished running. The read stopped at the **first**
// assignment, so a module that narrowed or grew its list afterwards exported the
// list it no longer had — and a list *built* rather than written out matched no
// branch at all, so the declaration was dropped and the module fell back to
// exporting everything: a file that states a contract and publishes past it,
// with nothing said.
//
// The table is the test. Four of the nine rows were wrong and one was reported.
describe('__all__ is read as the value the module ends with', () => {
    const BODY = '\n\ndef a():\n    return 1\n\n\ndef b():\n    return 2\n\n\ndef c():\n    return 3\n';

    const exported = (head) => {
        const line = plain(`${head}${BODY}`)
            .split('\n')
            .find((one) => one.startsWith('export {'));

        return line === undefined ? [] : line.replace(/export \{ | \};?/g, '').trim().split(', ');
    };

    test.for([
        ['one assignment', '__all__ = ["a"]', ['a']],
        // The reported defect: the first value won and the second was ignored.
        ['a second assignment', '__all__ = ["a"]\n__all__ = ["b"]', ['b']],
        // How a conditional export is written, and the same silence.
        ['an augmented assignment', '__all__ = ["a"]\n__all__ += ["b"]', ['a', 'b']],
        ['append', '__all__ = ["a"]\n__all__.append("b")', ['a', 'b']],
        ['extend', '__all__ = ["a"]\n__all__.extend(["b"])', ['a', 'b']],
        ['a tuple', '__all__ = ("a", "b")', ['a', 'b']],
        // No `__all__` at module level: the functions, as before. A name bound
        // inside a function is not the module's declaration.
        ['none at all', '', ['a', 'b', 'c']],
        ['one inside a function', 'def hide():\n    __all__ = ["a"]\n', ['hide', 'a', 'b', 'c']]
    ])('%s', ([, head, names]) => {
        expect(exported(head)).toEqual(names);
    });

    // The export list is read before the module runs, so a value the source does
    // not spell cannot be followed. Refused rather than dropped: dropping it is
    // what published everything.
    test.for([
        ['built from two lists', '__all__ = ["a"] + ["b"]'],
        ['computed by a call', '__all__ = sorted(["a"])'],
        ['taken from a name', 'NAMES = ["a"]\n__all__ = NAMES'],
        ['appended a computed name', '__all__ = ["a"]\n__all__.append("b" + "c")']
    ])('%s is refused', ([, head]) => {
        expect(() => plain(`${head}${BODY}`)).toThrow(/`__all__`/);
    });
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

// A class is a name `__all__` may hold, and until this it crossed to JavaScript
// as neither the class nor an error: `pyExport` sent it through `plainData`,
// which walks whatever it is given and hands back the attributes it found, so
// JavaScript received `__doc__`, `__qualname__`, `__dict__` and the methods.
//
// That was the residue of the repair above rather than something it broke: before
// it, the module failed to evaluate at all. A loud failure became a quiet wrong
// shape, which is the one direction this project does not accept.
//
// The other honest answer was to refuse the spelling, and it was dropped for a
// reason worth keeping: refusing an accurate Python `__all__` because JavaScript
// would need `$B.$call` to use one of its entries is a JavaScript limit imposed
// on Python.
//
// `typeof` cannot see any of this: a flattened copy of the attributes and the
// class itself are both `object`. The two measurements that tell them apart are
// the keys and the round trip, which is what the next two tests are.
describe('a class named in __all__ crosses as itself', () => {
    test('the module evaluates, which it did not before any of this', async () => {
        const mod = await import('./fixtures/exported_shapes.py');

        expect(mod.LIMIT).toBe(10);
    });

    test('and what crosses is the class, not a copy of its attributes', async () => {
        const mod = await import('./fixtures/exported_shapes.py');

        expect(mod.Widget.tp_name).toBe('Widget');
        expect(Object.keys(mod.Widget)).not.toContain('__qualname__');
    });

    // What JavaScript can do with it, and the reason handing it over beats
    // flattening it: give it back to Python.
    test('and Python can use it again on the other side', async () => {
        const mod = await import('./fixtures/exported_shapes.py');

        expect(mod.build(mod.Widget, 21)).toBe(42);
    });

    // The decision above lived at one site, `pyExport`, so every other path that
    // meets a class decided the opposite. A class inside a dict or a list came
    // out as `{__qualname__, __doc__, __module__}` and was not callable, which
    // is what a `load()` returning a registry of models hands a page.
    //
    // These three assertions are the rows this file did not have, and their
    // absence is why two days of readings did not see it.
    test.for([
        ['in a dict', (m) => m.registry.widget],
        ['in a list', (m) => m.pair[0]]
    ])('a class %s crosses as itself too', async ([, reach]) => {
        const mod = await import('./fixtures/exported_shapes.py');
        const cls = reach(mod);

        expect(cls.tp_name).toBe('Widget');
        expect(Object.keys(cls)).not.toContain('__qualname__');
    });

    test('and Python can use a nested one, which is the point', async () => {
        const mod = await import('./fixtures/exported_shapes.py');

        expect(mod.build(mod.registry.widget, 21)).toBe(42);
        expect(mod.build(mod.pair[0], 21)).toBe(42);
    });
});

// A name the module took from JavaScript. Brython wraps what crosses into
// Python, so the module holds a `JavascriptFunction` and not the function the
// library made, and a framework that checks its own object finds a stranger.
// SvelteKit's remote functions are exactly that: `accepted = query(_accepted)`
// in a `.remote.py`, and `vite-plugin-sveltekit-remote` refusing the export
// with `all exports from this file must be remote functions`.
describe('a name taken from JavaScript goes back as itself', () => {
    test('the export is the object the library built', async () => {
        const mod = await import('./fixtures/exported_js.py');

        expect(mod.marked.built_by).toBe('js_stamp');
    });

    test('and it still runs the Python it was given', async () => {
        const mod = await import('./fixtures/exported_js.py');

        expect(mod.marked()).toBe(42);
    });

    // The unwrapping reads one symbol, so a value Python made must not take
    // that door: `plain` is Python's own and crosses as data.
    test('a Python value beside it is untouched', async () => {
        const mod = await import('./fixtures/exported_js.py');

        expect(mod.plain).toBe(7);
    });
});
