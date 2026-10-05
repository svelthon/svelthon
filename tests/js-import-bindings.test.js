// A name `__js__` or `importjs` brings is JavaScript's import, which Python
// reads live. Python binding it, `global counter` then `counter = counter + 1`
// in a function, or `counter = …` at the top, made the compiler declare the name
// a second time beside the import: a module no engine loads, which the browser
// refuses with `Identifier 'counter' has already been declared`, and which only
// the test runner's rewriting of imports ran, into an error of its internals.
// And a write at run time to a name the module does not export was taken by
// Python's reader alone, JavaScript's keeping the import.
//
// JavaScript refuses both, a second declaration of an import and an assignment
// to one, and so does Python now: a binding written in the source when the file
// compiles, with its line, and a write at run time with a TypeError.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mount, flushSync } from './mounted.js';
import * as Private from './fixtures/js_import_private.py';
import { write, write_attribute } from './fixtures/js_import_private_writer.py';
import * as Source from './fixtures/js_reexport_source.js';
import JsImportWrite from './fixtures/JsImportWrite.svelte';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const plain = (body) => compile(`__js__ = {"./source.js": ["counter"]}\n${body}`, 'M', 'src/m.py', { plain: true }).script;
const component = (body) =>
    compile(`importjs {counter} from "./source.js"\n${body}`, 'Probe', 'src/Probe.svelte', {}).script;

// Every statement that binds a name, at the top of the module or under a
// `global`, with the line it is on, the import being line 1.
const BINDINGS = [
    ['an assignment', 'counter = 1', 2],
    ['an augmented assignment', 'counter += 1', 2],
    ['an annotated assignment', 'counter: int = 1', 2],
    ['a deletion', 'del counter', 2],
    ['a loop', 'for counter in []:\n    pass', 2],
    ['an import', 'import json as counter', 2],
    ['an import from', 'from json import dumps as counter', 2],
    ['a def', 'def counter():\n    pass', 2],
    ['a class', 'class counter:\n    pass', 2],
    ['a with', 'with ctx as counter:\n    pass', 2],
    ['an except', 'try:\n    pass\nexcept Exception as counter:\n    pass', 4],
    ['a match capture', 'match 1:\n    case counter:\n        pass', 3],
    ['a walrus', '(counter := 1)', 2],
    ['a walrus in a comprehension', '[(counter := x) for x in []]', 2],
    ['a global assigned in a def', 'def bump():\n    global counter\n    counter = counter + 1', 4],
    ['a global deleted in a def', 'def drop():\n    global counter\n    del counter', 4],
    ['a global in a nested def', 'def outer():\n    def inner():\n        global counter\n        counter = 1', 5],
    ['a global in a class body', 'class Holder:\n    global counter\n    counter = 1', 4]
];

const refusal = (source, line) =>
    new RegExp(`\`counter\` is a JavaScript import, which Python reads and never binds.*\\(${source}:${line}\\)`);

describe('a binding of a name JavaScript imports is refused, with its line', () => {
    test.for(BINDINGS)('in a .py: %s', ([, body, line]) => {
        expect(() => plain(body)).toThrow(refusal('src/m\\.py', line));
    });

    test.for(BINDINGS)('in a component: %s', ([, body, line]) => {
        expect(() => component(body)).toThrow(refusal('src/Probe\\.svelte', line));
    });
});

// What reads the name, or binds a name of its own that happens to be spelt the
// same in another scope, is no binding of the import. Each compiles to a module
// an engine parses: V8 itself, which is what refused the module above.
const READS = [
    ['a read', 'def read():\n    return counter'],
    ['a global that only reads', 'def read():\n    global counter\n    return counter'],
    ['a local of a def', 'def own():\n    counter = 1\n    return counter'],
    ['a parameter', 'def own(counter):\n    return counter'],
    ['a class attribute', 'class Holder:\n    counter = 1'],
    ['a comprehension variable', 'values = [counter for counter in range(3)]'],
    ['a walrus in a comprehension of a def', 'def own():\n    return [(counter := x) for x in range(3)]'],
    ['a lambda parameter', 'own = lambda counter: counter'],
    ['a nonlocal', 'def outer():\n    counter = 1\n    def inner():\n        nonlocal counter\n        counter = 2\n    return inner']
];

// Asked once, because spawning is not everyone's to do: a sandbox that forbids
// it answers `spawnSync … EPERM`, which says nothing about the code.
const canSpawn = (() => {
    try {
        execFileSync(process.execPath, ['-e', ''], { stdio: 'ignore' });

        return true;
    } catch {
        return false;
    }
})();

const parses = (script) => {
    try {
        execFileSync(process.execPath, ['--input-type=module', '--check'], { input: script, stdio: 'pipe' });

        return true;
    } catch (error) {
        return String(error.stderr);
    }
};

describe.skipIf(!canSpawn)('what only reads the name compiles to a module an engine loads', () => {
    test.for(READS)('%s', ([, body]) => {
        expect(parses(plain(body))).toBe(true);
    });
});

// At run time, each write Python can make to the module's names, the name not
// exported: refused as an assignment to an import is, and the import, read by
// Python and by JavaScript, keeps following its own module.
describe('a write at run time to a name JavaScript imports is refused', () => {
    test.for([
        ['through globals()[…]', () => Private.by_item()],
        ['through globals().update', () => Private.by_update()],
        ['through globals().pop', () => Private.by_pop()],
        ['through del globals()[…]', () => Private.by_delete()],
        ['from another module', () => write()],
        ['from another module, by setattr', () => write_attribute()]
    ])('%s', ([, writing]) => {
        Source.reset();

        expect(writing).toThrow(/'counter' is a JavaScript import of .*js_import_private\.py, and an import is read-only/);

        Source.bump();
        expect([Private.read(), Private.read_global(), Source.counter]).toEqual([1, 1, 1]);
    });

    test('in a component, and the page keeps following the import', () => {
        Source.reset();
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(JsImportWrite, { target });
        flushSync();

        expect(() => instance.overwrite()).toThrow(/'counter' is a JavaScript import of .*JsImportWrite\.svelte/);

        Source.bump();
        expect(instance.read_global()).toBe(1);
        target.remove();
    });
});
