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
import {
    directiveModules,
    overMarkup,
    pythonExpressions,
    collector,
    walrus
} from '../src/lib/markup.js';

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

// Brython gives the function it generates for a lambda a name of its own, and
// that name is not stable from one compilation to the next: it carries a counter
// that runs for the life of the process. It is the one part of the output that
// says nothing about the name the author wrote, so it is flattened on both
// sides. Measured the hard way, by a row that passed alone and failed beside
// another file.
const steady = (text) => text.replace(/lambda_[A-Za-z0-9_]+/g, 'lambda_N');

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

    // Found while reading §3.12, and it belongs here: the shorthand of a binding
    // reads a name too. This one failed loudly, Svelte answering `Can only bind
    // to state or props`, because the binding was left for it to resolve.
    test('the shorthand of a binding expands', () => {
        same((n) => markup(`<Child bind:${n} />`));
    });

    // Three more sites were still ASCII, written after the six above and on
    // different days. This one was silent and wrong rather than loud: `\w+`
    // cannot end immediately before the `(`, so a snippet whose name ends in an
    // accented letter lost its parameter list, and the body then read a
    // module-level name of the same spelling instead of the argument.
    // Its own pair, and the reason is the defect itself: `\w+` fails only when
    // the name *ends* in a non-ASCII letter, and `élève` ends in an ASCII `e`,
    // so the shared pair cannot reach this one.
    test('a snippet keeps its parameters', () => {
        const write = (n) => markup(`{#snippet ${n}(x)}{x}{/snippet}`);

        expect(write('ligné')).toBe(write('ligne').replaceAll('ligne', 'ligné'));
    });

    // And the name itself, which is what puts the snippet in the enclosing
    // scope: without it `<Card {nóm} />` compiled `nóm` as a free name.
    test('a snippet is a name in the scope around it', () => {
        same((n) => markup(`{#snippet ${n}(p)}{p}{/snippet}<Card {${n}} />`));
    });

    // `directiveModules` is what publishes a Python module under a JavaScript
    // name, so `in:fondés.tw` resolves. An accented module was never found, so
    // nothing was published and the directive reached a name that did not exist.
    test('a dotted directive finds its module', () => {
        same((n) => JSON.stringify(directiveModules(`<p in:${n}.tw>a</p>`)));
    });

    // `compile.cjs` asked the same question in seven places with one pattern,
    // and six of them read a *JavaScript* name, where ASCII is a defensible
    // line. The seventh read a Python one: what a `.py` exports. So
    // `__all__ = ["élèves"]` was filtered to nothing and the module exported
    // nothing at all, with no error and no warning.
    const moduleOf = (source) => {
        const { script } = compile(source, 'Probe', 'Probe.py', { plain: true });

        return steady(String(script));
    };

    test('a name in `__all__` is exported', () => {
        same((n) => moduleOf(`__all__ = ["${n}"]\n${n} = 1\n`));
    });

    // And a module with no `__all__` exports its functions by default, through
    // the same filter, so an accented one exported nothing either.
    test('a function is exported by default', () => {
        same((n) => moduleOf(`def ${n}():\n    return 1\n`));
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
