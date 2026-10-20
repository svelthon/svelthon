import v8 from 'node:v8';
import { runInNewContext } from 'node:vm';

import { test, expect, vi } from 'vitest';
import '../src/lib/bridge.js';
import { compile } from '../src/lib/compile.js';
import { mount, flushSync, settled } from './mounted.js';
import CoroutineAwaited from './fixtures/CoroutineAwaited.svelte';
import ComprehensionAwait from './fixtures/ComprehensionAwait.svelte';
import * as jsonText from './fixtures/json_text.py';

// Behaviours of the engine Svelthon rests on that only Svelthon shows: a
// component, its compiler, a helper of its own. The engine's other repairs are
// Bryntime's, and its own tests hold them.

// `javascript.JSON.parse` reads a subclass of str by its value, not by the
// object Brython keeps it in, and `from_json` is that parse.
test('a str subclass holding JSON is parsed', () => {
    expect(Array.from(jsonText.engine())).toEqual([42, 42]);
    expect(Array.from(jsonText.helper())).toEqual([42, 42]);
});

// A coroutine is reported as never awaited when it is reclaimed without
// having started, as CPython reports it: `{#await later()}` hands one to
// Svelte, which awaits it, and nothing is said; one created and thrown away
// is told once the garbage collector takes it, which the test forces.
test('a coroutine handed on is not reported as never awaited', async () => {
    const said = [];
    const spies = ['error', 'warn', 'log'].map((level) =>
        vi.spyOn(console, level).mockImplementation((...args) => said.push(args.join(' ')))
    );

    try {
        const target = document.body.appendChild(document.createElement('div'));
        mount(CoroutineAwaited, { target });

        await settled(() => expect(target.querySelector('[data-k="shown"]')?.textContent).toBe('done'));
        await new Promise((resolve) => setTimeout(resolve));

        expect(said.filter((one) => one.includes('never awaited'))).toEqual([]);

        target.querySelector('[data-k="drop"]').click();
        flushSync();
        await new Promise((resolve) => setTimeout(resolve));

        v8.setFlagsFromString('--expose-gc');
        const gc = runInNewContext('gc');

        await settled(() => {
            gc();
            expect(said.some((one) => one.includes("coroutine 'later' was never awaited"))).toBe(true);
        });
    } finally {
        for (const spy of spies) spy.mockRestore();
    }
});

// Four syntax errors Brython failed to raise, failing in its own code instead:
// a message dropped, a location read off the wrong fields, a helper called
// under a name that no longer exists, and a recursion past the stack. Each is
// the error CPython 3.14 raises for the same source.
test.for([
    ['fstring-conversion-message', 'x = 1\ny = f"{x!z}"\n', "f-string: invalid conversion character 'z': expected 's', 'r', or 'a'"],
    ['bytes-str-concat-message', 'x = b"a" "b"\n', 'cannot mix bytes and nonbytes literals'],
    ['future-import-errors', 'from __future__ import braces\n', 'not a chance'],
    ['future-import-errors', 'from __future__ import nothing_here\n', 'future feature nothing_here is not defined'],
    ['too-many-nested-parentheses', `x = ${'('.repeat(201)}1${')'.repeat(201)}\n`, 'too many nested parentheses']
])('syntax errors as CPython raises them: %s', ([, source, message]) => {
    expect(() => compile(source, 'Probe', 'probe.py', { plain: true })).toThrow(`SyntaxError: ${message}`);
});

// A comprehension holding an `await` is awaited, in `on_mount` too, where a
// page awaits its data: it was an async function nobody awaited, which handed
// back a Promise where a list was written.
test('a comprehension holding an await is awaited in on_mount', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ComprehensionAwait, { target });

    await settled(() => expect(target.textContent.trim()).toBe('[0, 2, 4]'));
    target.remove();
});

// A name bound while `globals()` is walked raises, as in CPython: held by
// Bryntime's walk of a namespace of Svelthon's, not by the engine, whose
// branch `globals-changed-size` is not vendored.
test("a walk of globals() by Svelthon's namespace refuses a name bound meanwhile", async () => {
    const { answers } = await import('./fixtures/js_values_and_namespaces.py');

    expect([...answers()][4]).toBe('RuntimeError');
});

// A module named with a quote, from a file such as `src/Jean's app/Page.svelte`,
// had its name pasted between quotes in the code of every def, lambda, class
// and comprehension, which then stopped parsing.
test('a quote in a module name leaves its functions parseable: module-name-quote-literals', () => {
    const body = 'def f():\n    return [x for x in (lambda: "ab")()]\n\nclass K:\n    y: int = 1\n';
    const { module } = compile(body, 'Probe', "src/Jean's app/Page.svelte");

    expect(() => new Function(module.replace(/^import .*$/gm, '').replace(/^export /gm, ''))).not.toThrow();
});
