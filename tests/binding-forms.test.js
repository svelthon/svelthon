// @vitest-environment node
//
// Which of Python's binding forms the compiler recognises, and it is a question
// nothing asked until this file existed.
//
// `surface()` reads four node kinds off the AST, `Assign`, `AnnAssign`,
// `FunctionDef` and `AsyncFunctionDef`, because those are the four that can
// carry a *signal*. Three other rules then read the same list, and for them the
// question is not "is this reactive" but "did the author take this word":
//
//   1. an injected helper is skipped where the author has a name of that
//      spelling. `date`, `batch`, `js` and eighteen others;
//   2. a JavaScript name from `<script module>` is published the same way;
//   3. `refuseLocked` refuses the six words of the dialect outright.
//
// So a name bound any other way was invisible to all three. `class date:`,
// `import date`, `for date in …` were injected over, and the author's write went
// to the injection's setter, which did nothing, so their name never existed. And
// `effect = 0` was refused while `for effect in …` was not, which is a rule that
// does not apply rather than a rule with an exception.
//
// The table below is the point of the file: it is the language's list, not the
// compiler's, so a form the compiler learns to miss again turns it red.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { parse } from 'svelte/compiler';

import { bind } from '../src/lib/bridge.js';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const script = (src) => compile(src, 'P', 'src/P.svelte').script;

// Every way Python binds a name at module level, written against `date`, which
// is an injected helper and the one measured in real code.
const FORMS = [
    ['a bare assignment', 'date = 1'],
    ['an annotated assignment', 'date: int = 1'],
    ['a chained assignment', 'other = date = 1'],
    ['a def', 'def date():\n    pass'],
    ['an async def', 'async def date():\n    pass'],
    ['a class', 'class date:\n    pass'],
    ['a plain import', 'import date'],
    ['a dotted import', 'import date.sub'],
    ['an aliased import', 'import calendrier as date'],
    ['a from-import', 'from calendrier import date'],
    ['an aliased from-import', 'from calendrier import jour as date'],
    ['a tuple unpacking', 'a, date = 1, 2'],
    ['a list unpacking', '[a, date] = [1, 2]'],
    ['a nested unpacking', 'a, (b, date) = 1, (2, 3)'],
    ['a starred unpacking', 'a, *date = [1, 2, 3]'],
    ['a for target', 'for date in [1]:\n    pass'],
    ['a for target inside an if', 'if True:\n    for date in [1]:\n        pass'],
    ['a with clause', 'with manager() as date:\n    pass'],
    ['an except clause', 'try:\n    pass\nexcept Exception as date:\n    pass'],
    ['a global written in a def', 'def go():\n    global date\n    date = 1'],
    ['a walrus at the top level', 'if (date := 1):\n    pass']
];

// The line the compiler emits when it believes nobody has taken the name.
const injected = (src) => script(src).includes("bind(__proto, 'date', () => __helpers.date,");

describe('a name the author bound is the author’s, however it was written', () => {
    test.for(FORMS)('%s keeps the name', ([, form]) => {
        expect(injected(`${form}\n`)).toBe(false);
    });

    // The other half of the same measurement: without one of these, the helper
    // is injected, which is what makes every row above mean something.
    test('and a module that takes nothing gets the helper', () => {
        expect(injected('x = 1\n')).toBe(true);
    });
});

// The six words of the dialect. `derived` and the rest are not builtins to
// shadow: redefining one is closer to redefining `def`.
describe('and a locked word is refused, however it was written', () => {
    const refused = (src) => {
        try {
            compile(src, 'P', 'src/P.svelte');
        } catch (error) {
            return error.message;
        }

        return null;
    };

    test.for(FORMS)('%s is refused', ([, form]) => {
        expect(refused(`${form.replaceAll('date', 'effect')}\n`)).toMatch(
            /`effect` is one of Svelthon's own words/
        );
    });

    test.for([['derived'], ['bindable'], ['export'], ['inspect'], ['inspect_with']])(
        'and so is %s, taken by a class',
        ([word]) => {
            expect(refused(`class ${word}:\n    pass\n`)).toMatch(/one of Svelthon's own words/);
        }
    );
});

// Which of them is state. A name the module binds to a value is, however the
// binding is written: a `for` target, a `with … as`, a `match` capture and an
// import bind as `=` does, and a list bound by one and appended to by a handler
// left the page showing its old length. A class is declared, and an `except …
// as` is unbound when the handler ends: neither is state.
describe('and the ones that bind a value become a signal', () => {
    const signals = (src) => [...script(src).matchAll(/let (\w+) = \$state\.raw/g)].map((m) => m[1]);

    test.for([
        ['a class', 'class thing:\n    pass'],
        ['an except clause', 'try:\n    pass\nexcept Exception as thing:\n    pass']
    ])('%s gets no signal', ([, form]) => {
        expect(signals(`${form}\n`)).not.toContain('thing');
    });

    // `*` names nothing, so it must not become a binding of its own: the script
    // still parses.
    test('a star import declares no name of its own', () => {
        const emitted = script('from browser import *\n');

        expect(emitted).not.toMatch(/\$state\.raw[^;]*\*|let \*|'\*'/);
        expect(() => parse(`<script>${emitted}</script>`)).not.toThrow();
    });

    // The names it binds get their accessors at run time, unsubscribed with the
    // component's own list, which the generated code hands over.
    test('and hands the runtime the list its names unsubscribe with', () => {
        const emitted = script('from browser import *\n');

        expect(emitted).toContain("Object.defineProperty(__proto, '$bryntimeStarred', { value: { owner: __subs } });");
        expect(emitted).toContain('const __subs = [];');
        expect(emitted).toContain('__unsubscribe(__subs)');
    });

    test.for([
        ['an assignment', 'thing = 1'],
        ['an import', 'import thing'],
        ['an import of a dotted name', 'import thing.sub'],
        ['an import renamed', 'import other as thing'],
        ['a name imported from a module', 'from other import thing'],
        ['a name imported and renamed', 'from other import name as thing'],
        ['a for target', 'for thing in [1]:\n    pass'],
        ['a for target unpacked', 'for other, thing in [(1, 2)]:\n    pass'],
        ['a with clause', 'with manager() as thing:\n    pass'],
        ['a match capture', 'match 1:\n    case thing:\n        pass'],
        ['a match capture in a sequence', 'match [1]:\n    case [*thing]:\n        pass'],
        ['a match capture in a mapping', 'match {}:\n    case {**thing}:\n        pass']
    ])('%s gets one', ([, form]) => {
        expect(signals(`${form}\n`)).toContain('thing');
    });
});

// A JavaScript name from `<script module>` is published for Python to read, and
// it reads the same list, so it had the same hole.
describe('a JavaScript name does not take a Python one either', () => {
    const publishes = (src, jsNames) =>
        compile(src, 'P', 'src/P.svelte', { jsNames }).script.includes(
            "bind(__proto, 'fades', () => __jsCall(fades))"
        );

    test('published when Python has no name of that spelling', () => {
        expect(publishes('x = 1\n', ['fades'])).toBe(true);
    });

    test.for([['class fades:\n    pass'], ['import fades'], ['for fades in [1]:\n    pass']])(
        'and skipped where it does: %s',
        ([form]) => {
            expect(publishes(`${form}\n`, ['fades'])).toBe(false);
        }
    );
});

// The second half of the repair, and the one the tests above cannot reach: with
// the list complete, no injection is ever placed over an author's name, so the
// setter behind it is never called. It is the belt behind the braces, tested
// here directly because nothing else can.
//
// A name bound with no setter is a *default*, and Brython writes a global as a
// plain property assignment on the namespace. Before this, that assignment
// walked the prototype chain, found `() => {}` and went nowhere: `class date: …`
// left no class behind. Now it writes an own property, which is what a prototype
// is for.
describe('an injected name is a default, not a wall', () => {
    const withDefault = () => {
        const proto = {};

        bind(proto, 'date', () => 'the helper');

        return Object.create(proto);
    };

    test('it answers until someone takes the name', () => {
        expect(withDefault().date).toBe('the helper');
    });

    test('and the author’s write is kept, not swallowed', () => {
        const namespace = withDefault();

        namespace.date = 'mine';

        expect(namespace.date).toBe('mine');
    });

    test('as an own property, so the default is only shadowed', () => {
        const namespace = withDefault();

        namespace.date = 'mine';

        expect(Object.hasOwn(namespace, 'date')).toBe(true);
        expect(Object.getPrototypeOf(namespace).date).toBe('the helper');
    });

    // A real setter is what a signal needs, and it must keep winning.
    test('while a name given a setter of its own still uses it', () => {
        const proto = {};
        const seen = [];

        bind(proto, 'count', () => 0, (value) => seen.push(value));

        const namespace = Object.create(proto);
        namespace.count = 7;

        expect(seen).toEqual([7]);
        expect(Object.hasOwn(namespace, 'count')).toBe(false);
    });
});
