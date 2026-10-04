// @vitest-environment node
//
// What a component can import: the modules the runtime holds, and the project's
// own `.py` files. Python's standard library does not ship, so an import of it
// is refused on its line when the component compiles, rather than failing at
// mount with a `JavascriptError` that `except ImportError` does not catch.
import { test, expect } from 'vitest';
import { mkdtempSync, writeFileSync, unlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { preprocess } from 'svelte/compiler';
import { python, svelthon } from '../src/lib/svelthon.js';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

// Through the real preprocessor, which is what knows the file system. The file
// has to exist, because the hook reads the source back to map its lines.
const FILE = 'src/App.svelte';

const compiled = (written) =>
    preprocess(`<script lang="python">\nx = 1\n${written}\n</script>\n\n<p>{x}</p>\n`, [python()], {
        filename: FILE
    });

test.for([
    ['import json', /`json` is not a module a component can import.*`from_json\(text\)`.*\(src\/App\.svelte:3\)/],
    ['from dataclasses import dataclass', /`dataclasses` is not a module.*standard library does not ship.*\(src\/App\.svelte:3\)/],
    ['try:\n    import math\nexcept ImportError:\n    math = None', /`math` is not a module.*`js\.Math`.*\(src\/App\.svelte:4\)/],
    ['def later():\n    import sys', /`sys` is not a module.*\(src\/App\.svelte:4\)/],
    ['import browser.timer', /`browser\.timer` is not a module/],
    ['from browser import document, timer', /`browser\.timer` is not a module.*\(src\/App\.svelte:3\)/],
    ['from __future__ import annotations', /`__future__` is not a module/]
])('`%s` is refused on its line', async ([written, message]) => {
    await expect(compiled(written)).rejects.toThrow(message);
});

// The line is counted from where the body starts, after the tag's `>`: an
// opening tag written over two lines made every line of the Python one too few.
test.for([['<script lang="python">\nx = 1\nimport json\n', 3], ['<script\n    lang="python">\nx = 1\nimport json\n', 4]])(
    'the line is the file s own, for a tag laid out as %j',
    async ([opening, line]) => {
        await expect(preprocess(`${opening}</script>\n\n<p>{x}</p>\n`, [python()], { filename: FILE })).rejects.toThrow(
            `(src/App.svelte:${line})`
        );
    }
);

// A module is found by its file name, beside the component or on `path`. A
// directory of the project, `src/lib` here, is not a package, and the refusal
// says so rather than blaming the standard library.
test.for([
    ['from lib import models', /`lib` is not a module.*`lib` is a directory.*add `lib` to `path`.*\(src\/App\.svelte:3\)/],
    ['import lib.models', /`lib\.models` is not a module.*`lib` is a directory/],
    ['from lib.models import greet', /`lib\.models` is not a module.*`lib` is a directory/]
])('`%s` is refused as a package', async ([written, message]) => {
    await expect(compiled(written)).rejects.toThrow(message);
    await expect(compiled(written)).rejects.not.toThrow(/standard library/);
});

// A relative import has no package to be relative to, whether its target exists
// or not, and the refusal writes the import that works.
test.for([
    ['from . import counter_store', /relative import.*`import counter_store`.*\(src\/App\.svelte:3\)/],
    ['from .counter_store import count as n', /relative import.*`from counter_store import count as n`/],
    ['from ..elsewhere import thing', /relative import.*`from elsewhere import thing`/]
])('`%s` is refused with its absolute spelling', async ([written, message]) => {
    await expect(compiled(written)).rejects.toThrow(message);
});

// Refused without the file system too, since no file makes it work.
test('a relative import is refused by the compiler alone', () => {
    expect(() => compile('from . import helper\n', 'C', 'src/C.svelte', { plain: true })).toThrow(
        /relative import.*`import helper`.*\(src\/C\.svelte:1\)/
    );
});

// The syntax of PEP 695 imports the standard library on its own: Brython builds
// an alias and a type parameter with `_typing`, so the component compiled and
// died at mount on `Network error`. Refused on its line, wherever it stands.
test.for([
    ['type Pair = tuple[int, int]', /`type Pair = …` builds its objects with `typing`.*`Pair = …` \(src\/C\.svelte:1\)/],
    ['def first[T](xs: list[T]) -> T:\n    return xs[0]', /`def first\[T\]` builds its objects with `typing`.*\(src\/C\.svelte:1\)/],
    ['class Box[T]:\n    pass', /`class Box\[T\]` builds its objects with `typing`/],
    ['def outer():\n    type Row = dict[str, str]\n    return Row', /`type Row = …`.*\(src\/C\.svelte:2\)/]
])('`%s` is refused on its line', ([written, message]) => {
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte')).toThrow(message);
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte', { plain: true })).toThrow(message);
});

// Brython's runtime imports `copyreg` for `__reduce__` and `__reduce_ex__`, and
// `pydoc` for `help()` asked about a name it cannot link to: both died at run
// time on `Network error`. Refused on their line, the way an import is.
test.for([
    ['class Box:\n    pass\n\nstate = Box().__reduce_ex__(2)', /`__reduce_ex__\(\)` builds its answer with `copyreg`.*\(src\/C\.svelte:4\)/],
    ['def save(box):\n    return box.__reduce__()', /`__reduce__\(\)` builds its answer with `copyreg`.*\(src\/C\.svelte:2\)/],
    ['help("str.join")', /`help\("str\.join"\)` looks the name up with `pydoc`.*`help\(obj\)` prints.*\(src\/C\.svelte:1\)/]
])('`%s` is refused on its line', ([written, message]) => {
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte')).toThrow(message);
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte', { plain: true })).toThrow(message);
});

// The builtins that need a parser, a module fetched at run time or a file
// system compiled, and died in the browser on `$B.Parser is not a constructor`
// or `Network error`. Refused while the name is the builtin.
test.for([
    ['x = eval("1 + 1")', /`eval\(\)` parses its text at run time.*\(src\/C\.svelte:1\)/],
    ['def run(code):\n    exec(code)', /`exec\(\)` parses its text.*\(src\/C\.svelte:2\)/],
    ['code = compile("1", "<s>", "eval")', /`compile\(\)` parses its text/],
    ['json = __import__("json")', /`__import__\(\)` loads a module at run time.*`import name`/],
    ['def read():\n    with open("notes.txt") as f:\n        return f.read()', /`open\(\)` reads a file.*\(src\/C\.svelte:2\)/]
])('`%s` is refused on its line', ([written, message]) => {
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte')).toThrow(message);
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte', { plain: true })).toThrow(message);
});

// What the name means is Python's question, scope by scope, as the symbol
// table answers it. An import binds a name without `as` too, so a project's own
// `compile` was refused with a sentence about the parser.
test.for([
    ['a function of the author s', 'def open(path):\n    return path\n\nopen("x")'],
    ['a parameter', 'def run(evaluate, compile):\n    return compile(evaluate("1"))'],
    ['an import without as', 'from regexes import compile\npattern = compile("a+")'],
    ['another', 'from db import exec\nrows = exec("select 1")'],
    ['help imported from a module', 'from docs import help\nhelp("intro")']
])('%s of that name is theirs', ([, written]) => {
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte', { plain: true })).not.toThrow();
});

// A method the file defines itself is the author's, whatever its name and
// however the class binds it, and `builtins` is the module only when the file
// imports it under that name. Run against CPython's answers in
// `own-reduce.test.js`.
test.for([
    ['an own __reduce__', 'class Box:\n    def __reduce__(self):\n        return 42\n\nanswer = Box().__reduce__()'],
    ['an own __reduce_ex__', 'class Box:\n    def __reduce_ex__(self, p):\n        return 42\n\nanswer = Box().__reduce_ex__(2)'],
    ['a __reduce__ bound to a lambda', 'class Box:\n    __reduce__ = lambda self: 42\n\nanswer = Box().__reduce__()'],
    [
        'an async __reduce__',
        'class Box:\n    async def __reduce__(self):\n        return 42\n\nasync def run():\n    return await Box().__reduce__()'
    ],
    ['an object named builtins', 'class Own:\n    def eval(self, v):\n        return v + 1\n\nbuiltins = Own()\nanswer = builtins.eval(41)']
])('%s is theirs', ([, written]) => {
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte', { plain: true })).not.toThrow();
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte')).not.toThrow();
});

test('while the builtins module imported under another name is still refused', () => {
    expect(() => compile('import builtins as b\nx = b.eval("1")\n', 'C', 'src/C.svelte', { plain: true })).toThrow(
        /`eval\(\)` parses its text/
    );
});

// And the builtin is refused however it is reached: handed on, read through
// the `builtins` module, imported from it, or called in one function while
// another binds a local of the same name.
test.for([
    ['handed on', 'run = eval\nx = run("1 + 1")', /`eval\(\)` parses its text.*\(src\/C\.svelte:1\)/],
    ['through builtins', 'import builtins\nx = builtins.eval("1 + 1")', /`eval\(\)` parses its text.*\(src\/C\.svelte:2\)/],
    ['imported from builtins', 'from builtins import open', /`open\(\)` reads a file.*\(src\/C\.svelte:1\)/],
    [
        'beside a local of that name',
        'def safe():\n    eval = len\n    return eval([1])\n\nx = eval("1")',
        /`eval\(\)` parses its text.*\(src\/C\.svelte:5\)/
    ]
])('the builtin %s is refused', ([, written, message]) => {
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte', { plain: true })).toThrow(message);
});

// What needs none of them compiles: `help` of an object prints its docstring, of
// a builtin or a standard module's name links to the documentation, and a `help`
// of the author's own is theirs.
test.for([
    'help(len)',
    'help("len")',
    'help("json")',
    'def help(topic):\n    return topic\n\nhelp("anything")',
    'class Box:\n    def __reduce__(self):\n        return (Box, ())'
])('`%s` compiles', (written) => {
    expect(() => compile(`${written}\n`, 'C', 'src/C.svelte')).not.toThrow();
});

// The annotations PEP 695 replaces compile as they always did.
test('a generic annotation without parameters compiles', () => {
    expect(() => compile('def first(xs: list[int]) -> int:\n    return xs[0]\n', 'C', 'src/C.svelte')).not.toThrow();
});

test('an import the runtime holds compiles', async () => {
    await expect(
        compiled('import browser.html\nfrom browser import document, html, aio\nfrom javascript import JSON')
    ).resolves.toHaveProperty('code');
});

// A `.py` module goes through the plugin, and is held to the same rule.
test('a module importing the standard library is refused too', () => {
    const plugin = svelthon({ path: [] });

    expect(() => plugin.load('tests/fixtures/stdlib_import.py')).toThrow(
        /`random` is not a module.*`js\.Math\.random\(\)`.*stdlib_import\.py:3\)/
    );
});

// A compiled `.py` is kept while it is unchanged, and what its imports resolve
// to is part of that: a module it imports removed, it is checked again.
test('a module whose import disappears is checked again', () => {
    const directory = mkdtempSync(join(tmpdir(), 'svelthon-imports-'));
    const importer = join(directory, 'importer.py');
    const imported = join(directory, 'imported.py');
    writeFileSync(importer, 'import imported\n\nvalue = imported.VALUE\n');
    writeFileSync(imported, 'VALUE = 1\n');

    try {
        const plugin = svelthon({ path: [] });
        const load = () => plugin.load.call({ addWatchFile() {} }, importer);

        expect(load).not.toThrow();
        unlinkSync(imported);
        expect(load).toThrow(/`imported` is not a module.*importer\.py:1\)/);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
