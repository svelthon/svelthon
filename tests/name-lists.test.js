// @vitest-environment node
//
// Kinds of name against the places a name can be declared.
//
// Four lists decide what happens to a name an author writes, and each arrived
// with its own defect: the helpers the author's own spelling shadows, the six
// words Svelthon refuses, the words JavaScript reserves, and the `__` prefix the
// compiler builds its own names out of. A fifth was found the hard way — a name
// the generated code happened to use for itself, `v`, which shadowed a
// module-level `v` in silence for the life of the component.
//
// What they have in common is the failure they produce when a rule lives at one
// site and not at its neighbour, and this file is the shape that answers it:
// **the verdict belongs to the row, not to the cell**. A name is refused because
// of what it is, wherever it is written, or it is accepted everywhere.
//
// The two columns that are not the same question are kept apart on purpose:
//
// - **Svelthon's own words** are refused in the script and accepted in the
//   markup. Measured: a name the markup declares becomes a *parameter* of the
//   generated function, so `{effect = 2}` shadows nothing outside the template
//   and the decorator cannot be written there anyway. The script's rule is about
//   a reader losing the file; a template-local name loses nobody.
// - **A word JavaScript reserves** is refused in the script by us and in the
//   markup by Svelte, which parses what we emit and says so in its own words.
//   The assertion is that it does not pass in silence, not whose sentence it is.
//
// The cell that was empty when this file was written: the compiler's prefix in
// the markup. `{__expr_0 = 2}` emitted a declaration whose value is read from a
// function of the same name, in the same scope, and Svelte accepted it. The
// script half had refused that since the beginning.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { compile as compileSvelte } from 'svelte/compiler';
import { overMarkup, pythonExpressions, collector } from '../src/lib/markup.js';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

const script = (source) => String(compile(source, 'Probe', 'Probe.svelte').script);
const moduleOf = (source) => String(compile(source, 'Probe', 'Probe.py', { plain: true }).script);

// The markup pass, then Svelte over what it emitted: the second half is where a
// reserved word is caught, and leaving it out would report silence as success.
const markup = (body) => {
    const defs = [];
    const out = overMarkup(body, (source, at) =>
        pythonExpressions(source, collector(defs), undefined, at));

    compileSvelte(`<script>let rows = [];</script>${out}`, { name: 'Probe' });

    return out;
};

const OURS = {
    locked: /is one of Svelthon's own words/,
    reserved: /is a reserved word in JavaScript/,
    prefix: /starts with `__`, which is the compiler's own prefix/
};

// Svelte's own refusal of a JavaScript keyword, in the two shapes it takes.
const SVELTE = /reserved word|Unexpected keyword/;

const ROWS = [
    ['an ordinary name', 'total', null, null],
    ['a helper the author shadows', 'date', null, null],
    ['a Python builtin', 'list', null, null],
    // The setter's parameter used to be `v`, so a module-level `v` was shadowed
    // by it: the assignment wrote the parameter and the name stayed undefined.
    ['a name the generated code once took', 'v', null, null],
    ["one of Svelthon's own words", 'effect', OURS.locked, null],
    ['a word JavaScript reserves', 'new', OURS.reserved, SVELTE],
    ["the compiler's own prefix", '__x', OURS.prefix, OURS.prefix]
];

// Where the script declares a name.
const IN_SCRIPT = [
    ['state', (n) => script(`${n} = 1\n`)],
    ['a prop', (n) => script(`${n}: str\n`)],
    ['a bindable', (n) => script(`${n}: str <=> "a"\n`)],
    ['a def', (n) => script(`def ${n}():\n    return 1\n`)],
    ['a derived', (n) => script(`t = 1\n${n} => t * 2\n`)],
    ['an effect', (n) => script(`@effect\ndef ${n}():\n    pass\n`)],
    ['a name in `__all__`', (n) => moduleOf(`__all__ = ["${n}"]\n${n} = 1\n`)]
];

// And where the markup does.
const IN_MARKUP = [
    ['a template declaration', (n) => markup(`<p>{${n} = 2}{${n}}</p>`)],
    ["a block's own alias", (n) => markup(`{#each rows as ${n}}{${n}}{/each}`)],
    ['a snippet', (n) => markup(`{#snippet ${n}(x)}{x}{/snippet}`)]
];

// Three places a name is not a binding, where every word is free: Python is
// Python, and `{"export": 1}` is a string.
const NEVER_A_BINDING = [
    ['a local inside a def', (n) => script(`def go():\n    ${n} = 1\n    return ${n}\n`)],
    ['a key of a dict', (n) => script(`d = {"${n}": 1}\n`)],
    ['an attribute', (n) => script(`class B:\n    pass\n\nb = B()\nb.${n} = 1\n`)]
];

describe.for(ROWS)('%s', ([, name, inScript, inMarkup]) => {
    test.for(IN_SCRIPT)('declared as %s', ([, write]) => {
        if (inScript === null) expect(() => write(name)).not.toThrow();
        else expect(() => write(name)).toThrow(inScript);
    });

    test.for(IN_MARKUP)('declared as %s', ([, write]) => {
        if (inMarkup === null) expect(() => write(name)).not.toThrow();
        else expect(() => write(name)).toThrow(inMarkup);
    });

    test.for(NEVER_A_BINDING)('free as %s', ([, write]) => {
        expect(() => write(name)).not.toThrow();
    });
});
