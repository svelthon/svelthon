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
            /`__all__` names `Nope`, which this module never binds \(src\/m\.py:1\)/
        );
    });

    test.for([
        ['class Nope:\n    pass'],
        ['import Nope'],
        ['for Nope in [1]:\n    pass'],
        // The captures of a `match` pattern bind in the module too.
        ['match {"a": 7}:\n    case {"a": Nope}:\n        pass'],
        ['match [1, 2]:\n    case [1, *Nope]:\n        pass'],
        ['match {"a": 7}:\n    case {**Nope}:\n        pass'],
        ['match 7:\n    case int() as Nope:\n        pass']
    ])(
        'while %s satisfies it',
        ([form]) => {
            expect(() => plain(`__all__ = ["Nope"]\n\n${form}\n`)).not.toThrow();
        }
    );

    // A value pattern refers to a name and binds none.
    test('but a value pattern does not', () => {
        expect(() => plain('__all__ = ["Nope"]\n\nclass C:\n    X = 1\n\nmatch 1:\n    case C.X:\n        pass\n')).toThrow(
            /`__all__` names `Nope`, which this module never binds/
        );
    });
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
        ['one inside a function', 'def hide():\n    __all__ = ["a"]\n', ['hide', 'a', 'b', 'c']],
        // Every mutation whose result the source spells, followed to the end.
        ['clear', '__all__ = ["a"]\n__all__.clear()', []],
        ['pop', '__all__ = ["a", "b"]\n__all__.pop()', ['a']],
        ['pop at an index', '__all__ = ["a", "b"]\n__all__.pop(0)', ['b']],
        ['pop from the end', '__all__ = ["a", "b"]\n__all__.pop(-1)', ['a']],
        ['remove', '__all__ = ["a", "b"]\n__all__.remove("a")', ['b']],
        ['insert', '__all__ = ["b"]\n__all__.insert(0, "a")', ['a', 'b']],
        ['sort', '__all__ = ["b", "a"]\n__all__.sort()', ['a', 'b']],
        // The order is Python's all the way, since a later `pop()` reads it.
        ['reverse, then pop', '__all__ = ["a", "b"]\n__all__.reverse()\n__all__.pop()', ['b']],
        ['sort, then pop', '__all__ = ["b", "a"]\n__all__.sort()\n__all__.pop()', ['a']],
        ['insert, then pop', '__all__ = ["a"]\n__all__.insert(0, "b")\n__all__.pop()', ['b']],
        ['insert from the end', '__all__ = ["a", "b"]\n__all__.insert(-1, "c")\n__all__.pop()', ['a', 'c']],
        // A name the module binds where a definition stands: a walrus in a
        // default, a base or a decorator is evaluated in the module.
        ['a walrus in a default', '__all__ = ["answer"]\ndef take(value=(answer := 7)):\n    return value', ['__export_answer as answer']],
        ['a walrus in a class base', '__all__ = ["answer"]\nclass Alias((answer := object)):\n    pass', ['__export_answer as answer']],
        // A parameter, a closure or a lambda's own `__all__` is not the module's.
        ['a parameter of that name', 'def shrink(__all__):\n    __all__.clear()\n', ['shrink', 'a', 'b', 'c']],
        ['a closure over one', 'def outer():\n    __all__ = []\n    def shrink():\n        __all__.clear()\n    return shrink\n', ['outer', 'a', 'b', 'c']],
        // Python allows a name twice; JavaScript refuses a duplicate export.
        ['a name listed twice', '__all__ = ["a", "a"]', ['a']],
        ['annotated', '__all__: list[str] = ["a"]', ['a']],
        // Reading the list, or a list of that name in a scope of its own, is
        // not a write.
        ['read', '__all__ = ["a"]\nn = __all__.count("a")', ['a']],
        // A read that keeps the list where the compiler sees it: a copy, a
        // length, a membership, a loop, a comprehension, a format.
        [
            'read without handing it on',
            '__all__ = ["a"]\ncopy = list(__all__)\ncopy.clear()\nn = len(__all__)\nok = "a" in __all__\n' +
                'for one in __all__:\n    pass\nnames = [one for one in __all__]\ntext = f"{__all__}"',
            ['a']
        ],
        ['a class attribute', 'class C:\n    __all__ = ["x"]\n\n__all__ = ["a"]', ['a']]
    ])('%s', ([, head, names]) => {
        expect(exported(head)).toEqual(names);
    });

    // A write the static read cannot follow: under a condition, in a loop, in
    // a function that declares the name global, item by item, or through a
    // method or an operator whose result the source does not spell.
    test.for([
        ['appended under a condition', '__all__ = ["a"]\nif True:\n    __all__.append("b")', 3],
        ['removed in a try', '__all__ = ["a"]\ntry:\n    __all__.remove("a")\nexcept ValueError:\n    pass', 3],
        ['cleared by a function', '__all__ = ["a"]\ndef reset():\n    __all__.clear()', 3],
        ['assigned by a global function', '__all__ = ["a"]\ndef reset():\n    global __all__\n    __all__ = []', 4],
        ['an item stored', '__all__ = ["a"]\n__all__[0] = "b"', 2],
        ['an item deleted', '__all__ = ["a", "b"]\ndel __all__[0]', 2],
        ['the name deleted', '__all__ = ["a"]\ndel __all__', 2],
        ['popped at a computed index', '__all__ = ["a"]\ni = 0\n__all__.pop(i)', 3],
        ['multiplied', '__all__ = ["a"]\n__all__ *= 2', 2],
        ['sorted by a key', '__all__ = ["a"]\n__all__.sort(key=len)', 2],
        ['changed in a class body', '__all__ = ["a"]\nclass C:\n    __all__.append("b")', 3],
        ['changed in a default', '__all__ = ["a"]\ndef f(x=__all__.clear()):\n    pass', 2],
        ['popped into a name', '__all__ = ["a", "b"]\nx = __all__.pop()', 2],
        ['rebound by a loop', '__all__ = ["a"]\nfor __all__ in [["b"]]:\n    pass', 2],
        // Handed on, the list can be changed where no static reading follows.
        ['handed to a name', '__all__ = ["a"]\nnames = __all__\nnames.clear()', 2],
        ['handed to a function', '__all__ = ["a"]\nlist.clear(__all__)', 2],
        ['returned', '__all__ = ["a"]\ndef exports():\n    return __all__', 3],
        // A builtin's name is the builtin only where nothing else binds it.
        ['handed to a function named list', 'def list(values):\n    values.clear()\n\n__all__ = ["a"]\nlist(__all__)', 5],
        ['handed to a parameter named len', '__all__ = ["a"]\ndef count(len):\n    return len(__all__)', 3],
        // Python raises at import on these: the module never runs past them.
        ['a name removed that is not there', '__all__ = ["a"]\n__all__.remove("z")', 2],
        ['an empty list popped', '__all__ = []\n__all__.pop()', 2]
    ])('%s is refused, at its line', ([, head, line]) => {
        let error;
        try {
            plain(`${head}${BODY}`);
        } catch (thrown) {
            error = thrown;
        }

        expect(error?.message).toMatch(/`__all__` (is|has) /);
        expect(error?.start?.line).toBe(line);
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

    // The same read as a `.py`: a name taken back out is not published.
    test('nor state the module removed from the list', () => {
        expect(store('__all__ = ["count"]\ncount = 0\n__all__.clear()\n')).not.toContain('get count()');
    });

    test('the listed function is on it, and exported by name', () => {
        const script = store(MODULE);

        expect(script).toContain('get bump()');
        expect(script).toContain('export { __export_bump as bump };');
    });

    test('and the unlisted function is neither', () => {
        expect(store(MODULE)).not.toContain('get unlisted()');
        expect(store(MODULE)).not.toContain('as unlisted');
    });

    // A class has no signal, and the store published only names that have
    // one, so the check above let it through and the store left it out.
    test('a listed class is on it, as itself', async () => {
        const { store: published } = await import('./fixtures/listed_class_store.svelte.py');

        expect(published.Widget.tp_name).toBe('Widget');
    });

    // A module that says nothing exports everything, which is what every store
    // in the project relies on.
    test('a module with no __all__ still publishes all of it', () => {
        const script = store('count = 0\nhidden = 99\n\n\ndef bump():\n    pass\n');

        expect(script).toContain('get count()');
        expect(script).toContain('get hidden()');
        expect(script).toContain('export { __export_bump as bump };');
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

// A star import binds names the source does not spell, and `__all__` may hand
// them on, as Python allows. The module reads them off its namespace once it
// has run, in a `.py` and a `.svelte.py` alike, and a name nothing brought is
// refused then, in the sentence the compiler says when nothing can bind it.
describe('__all__ hands on what a star import brought', () => {
    const published = (mod) => mod.store ?? mod;

    test.for([
        ['a .py', './fixtures/reexport_star.py', './fixtures/reexport_named.py'],
        ['a .svelte.py', './fixtures/reexport_star_store.svelte.py', './fixtures/reexport_named_store.svelte.py']
    ])('%s publishes them as it publishes names imported one by one', async ([, star, named]) => {
        const starred = published(await import(star));
        const listed = published(await import(named));

        expect(Object.keys(starred)).toEqual(Object.keys(listed));
        expect([...starred.rows]).toEqual([...listed.rows]);
        expect(starred.label()).toBe('from the module');
    });

    // A store hands JavaScript the container itself, here the source module's.
    test('a .svelte.py hands on the very list the source holds', async () => {
        const starred = published(await import('./fixtures/reexport_star_store.svelte.py'));
        const listed = published(await import('./fixtures/reexport_named_store.svelte.py'));

        expect(starred.rows).toBe(listed.rows);
    });

    test('and takes a write through the store, as a name imported by name does', async () => {
        const starred = published(await import('./fixtures/reexport_star_store.svelte.py'));
        const before = starred.rows;

        try {
            starred.rows = [7];

            expect([...starred.rows]).toEqual([7]);
        } finally {
            starred.rows = before;
        }
    });

    test.for([
        ['a .py', './fixtures/reexport_missing.py', /\(tests\/fixtures\/reexport_missing\.py:4\)/],
        ['a .svelte.py', './fixtures/reexport_missing_store.svelte.py', /\(tests\/fixtures\/reexport_missing_store\.svelte\.py:4\)/]
    ])('in %s, a name the star import did not bring is refused once the module has run', async ([, path, where]) => {
        const refused = import(path);

        await expect(refused).rejects.toThrow(/`__all__` names `nope`, which this module never binds/);
        await expect(refused).rejects.toThrow(where);
    });

    // Without a star import nothing can bind the name, and the compiler says so.
    test('without one, the compiler still refuses it', () => {
        expect(() => plain('from calendrier import date\n__all__ = ["nope"]\n')).toThrow(
            /`__all__` names `nope`, which this module never binds \(src\/m\.py:2\)/
        );
    });
});
