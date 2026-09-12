// @vitest-environment node
//
// Python 3 accepts `année = 1` and so does Svelthon: it compiles, it becomes
// state, it works. The six signs the dialect adds to Python each matched a name
// with `[A-Za-z_]\w*`, and JavaScript's `\w` is ASCII, so the same name was a
// name to the script half and not to any of the signs. Three of the six then
// failed in silence: `{totál = 2}` emitted `__text(totál = 2)`, a call with a
// keyword argument, which is valid Python and reaches the author as a TypeError
// naming a generated function.
//
// The decision behind the repair, because it could have gone the other way:
// **a name is whatever Python says a name is**. Refusing accented names with a
// sentence would also have been honest, but the script half already takes them,
// so refusing them at the signs would leave the dialect disagreeing with itself
// about what a name is. The audience decides the rest: this project has a lycée
// front end in its plans, and `année`, `élève` and `moyenne` are the words those
// authors write.
//
// Every row below is written twice, once in ASCII and once accented, and the
// two outputs must be the same text. Asserting the shape would be asserting
// what the compiler happens to emit; asserting the *sameness* is the rule.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import { overMarkup, pythonExpressions, collector, walrus } from '../src/lib/markup.js';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');

// Distinct enough that substituting one for the other cannot touch anything
// else in the output.
const ASCII = 'eleve';
const ACCENTED = 'élève';

const markup = (body) => {
    const defs = [];
    const out = overMarkup(body, (source, at) =>
        pythonExpressions(source, collector(defs), undefined, at));

    return `${out}\n${defs.join('\n')}`;
};

const script = (source) => {
    const { script: emitted, module } = compile(source, 'Probe', 'Probe.svelte');

    return `${emitted}\n${module}`;
};

// Brython names the functions it generates for a lambda with a counter that
// runs for the life of the process, so compiling the same source twice differs
// there and nowhere else.
const steady = (text) => text.replace(/\d{6,}/g, 'N');

describe('an accented name is a name', () => {
    const same = (write) =>
        expect(steady(write(ACCENTED))).toBe(steady(write(ASCII)).replaceAll(ASCII, ACCENTED));

    test('`=` in the script makes state', () => {
        same((n) => script(`${n} = 2\n`));
    });

    test('`=>` in the script makes a derived', () => {
        same((n) => script(`total = 1\n${n} => total * 2\n`));
    });

    test('`<=>` in the script makes a bindable', () => {
        same((n) => script(`${n}: str <=> "a"\n`));
    });

    test('`=` in the markup declares', () => {
        same((n) => markup(`<p>{${n} = 2}</p>`));
    });

    test('`=>` in the markup declares a derived', () => {
        same((n) => markup(`<p>{${n} => 2}</p>`));
    });

    test('`:=` in a handler writes through the namespace', () => {
        same((n) => walrus(`lambda: (${n} := 1)`));
    });

    test('the shorthand expands, so the read goes through the accessor', () => {
        same((n) => markup(`<p {${n}}></p>`));
    });

    test('a block name is a block name', () => {
        same((n) => markup(`{#each rows as ${n}}{${n}}{/each}`));
    });

    // The two refusals that read a name have to recognise the same one.
    test('an indented `=>` is refused by its own sentence', () => {
        for (const name of [ASCII, ACCENTED]) {
            expect(() => script(`def go():\n    ${name} => 2\n`))
                .toThrow(/a derived and an effect both belong at the top level/);
        }
    });

    test('writing a markup name from a handler is refused', () => {
        for (const name of [ASCII, ACCENTED]) {
            expect(() => markup(`<p>{${name} = 1}<button onclick={lambda: (${name} := 2)}>x</button></p>`))
                .toThrow(/is declared by the markup/);
        }
    });
});
