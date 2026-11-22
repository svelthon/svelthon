// A module's namespace is read and never written through its doors: what each
// name is, a cell, a key of a store, a prop, is decided from the text, so a
// write through `globals()`, `vars()` or `locals()` at the module's level is
// refused at its line, and at run time a door refuses the write no text
// shows: a namespace handed to a function that writes into it, a function's
// `__globals__`, a frame's `f_globals`, `builtins.globals()`. A read stays, and
// so do `vars()` and `locals()` in a function, which are the function's own.
import { test, expect } from 'vitest';
import { preprocess } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';
import { mount, flushSync } from './mounted.js';
import NamespaceHanded from './fixtures/NamespaceHanded.svelte';
import * as Target from './fixtures/attribute_target.py';
import { writes } from './fixtures/attribute_writer.py';
import { attempts, ordinary } from './fixtures/namespace_doors.py';

const FILE = 'src/App.svelte';
const compiled = (script, markup = '<p>{x}</p>') =>
    preprocess(`<script lang="python">\nx = 1\n${script}\n</script>\n\n${markup}\n`, [python()], { filename: FILE });
const refusal = (spelling, line) => "`" + spelling + "` writes the module's namespace, which its doors read and never write (" + FILE + ':' + line;

test.for([
    ['globals()["y"] = 2', 'globals()[…] = …', 3],
    ['globals()["x"] += 1', 'globals()[…] = …', 3],
    ['del globals()["x"]', 'del globals()[…]', 3],
    ['globals().update(y=2)', 'globals().update(…)', 3],
    ['globals().pop("x")', 'globals().pop(…)', 3],
    ['globals().setdefault("y", 2)', 'globals().setdefault(…)', 3],
    ['globals().clear()', 'globals().clear(…)', 3],
    ['vars()["y"] = 2', 'vars()[…] = …', 3],
    ['locals()["y"] = 2', 'locals()[…] = …', 3],
    ['def f():\n    globals()["y"] = 2', 'globals()[…] = …', 4]
])('`%s` is refused on its line', async ([script, spelling, line]) => {
    await expect(compiled(script)).rejects.toThrow(refusal(spelling, line));
});

// Where the name is the builtin, which no scope binds: a parameter named
// `globals`, a `vars` of the module's own and an instance's `f_globals` are the
// author's, and were refused.
test.for([
    'def apply(globals):\n    globals().update(status="published")',
    'def vars():\n    return {}\nvars()["a"] = 1',
    'class Record:\n    pass\nsnapshot = Record()\nsnapshot.f_globals = {}\nsnapshot.f_globals["a"] = 1'
])('`%s` compiles', async (script) => {
    await expect(compiled(script)).resolves.toBeTruthy();
});

// And they write as Python does, where what an attribute reaches, a function's
// `__globals__`, a frame's `f_globals`, `builtins.globals()`, is refused as it
// is written.
test('a door an attribute reaches refuses the write at run time, and what only looks like one writes', () => {
    expect([[...attempts], [...ordinary]]).toEqual([
        ['refused', 'refused', 'refused'],
        ['published', 'own', 1]
    ]);
});

test('a write through a door in the markup is refused at the markup', async () => {
    await expect(compiled('', '<button onclick={lambda: globals().update(y=2)}>go</button>')).rejects.toThrow(
        refusal('globals().update(…)', 6)
    );
});

test('a read through a door, and vars() or locals() in a function, compile', async () => {
    const script = [
        'y = globals()["x"]',
        'z = globals().get("x")',
        'has = "x" in globals()',
        'def f():',
        '    vars()["a"] = 1',
        '    locals()["b"] = 2',
        '    return len(globals())'
    ].join('\n');

    await expect(compiled(script)).resolves.toBeTruthy();
});

test('a namespace handed to a function that writes into it refuses the write at run time', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(NamespaceHanded, { target });
    flushSync();

    expect(target.querySelector('[data-k="view"]').textContent).toBe('refused|refused|1|1');
});

// And another module writes a name the text has on it, one only a function
// binds among them, which JavaScript reads written; it adds none, which
// JavaScript, importing the names of the text, read undefined where Python
// read it, and deletes none.
test('another module writes a name the text has, and adds or deletes none', () => {
    const seen = writes();

    expect(seen.slice(0, 3)).toEqual(['written', 5, 'written']);
    expect(seen[3]).toMatch(/^refused: svelthon — `phantom` is no name of module `attribute_target`, whose names are those its text binds/);
    expect(seen[4]).toMatch(/^refused: svelthon — `x` of module `attribute_target` is deleted by the module's own text/);
    expect([seen[5], Target.x, Target.ready]).toEqual([false, 5, false]);
});
