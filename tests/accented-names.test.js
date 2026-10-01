// @vitest-environment node
//
// Alphabets against the places the dialect reads a name.
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
// **The assertion is sameness, not shape.** Every site is written twice, once in
// ASCII and once in the alphabet under test, and the two outputs must be the
// same text once the name is substituted. Asserting what the compiler emits
// would be asserting what it happens to emit today; asserting that one name
// behaves like another is the rule itself.
//
// This file held one row for a fortnight, French, and the sites were added to it
// one defect at a time — six signs, then a snippet, then a directive, then what
// a `.py` exports. They are the same question asked in sixteen places, so the
// rows are a list now: a second alphabet costs a line, and a seventeenth site
// costs a line. `élève` ends on an ASCII letter, which is why it could never
// reach the defect where a name ends immediately before a `(`; every row below
// it ends on a letter `\w` does not know, and one of them is written in a script
// with no ASCII letter at all.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';
import {
    overMarkup,
    pythonExpressions,
    collector,
    walrus
} from '../src/lib/markup.js';

const require = createRequire(import.meta.url);
const { compile } = require('../src/lib/compile.cjs');

// Distinct enough that substituting it cannot touch anything else in the output.
const ASCII = 'eleve';

// One row per reason, not one per language: what a pattern can get wrong about a
// name is where its letters sit in Unicode, not which country writes them.
//
// **Every row is five characters long**, like the reference, and that is a
// property of the measurement rather than of the names: part of what the
// compiler emits is Brython's `frame.positions`, which carries the *column* a
// statement ends at. A shorter name moves those numbers, and the comparison
// below would report a difference that is only its own. Found by writing a
// four-letter row and a two-letter one, and reading the diff rather than
// believing it.
const ALPHABETS = [
    ['a Latin name with accents', 'élève'],
    ['a name that ends on an accent', 'ligné'],
    ['a Greek name', 'μέσος'],
    ['a Cyrillic name', 'метка'],
    // No case, no ASCII letter anywhere, and nothing `\p{M}` or `\p{N}` can
    // match: the row that shares the least with the reference.
    ['a Chinese name', '学生平均分']
];

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

const moduleOf = (source) => {
    const { script: emitted } = compile(source, 'Probe', 'Probe.py', { plain: true });

    return String(emitted);
};

// Brython gives the function it generates for a lambda a name of its own, and
// that name is not stable from one compilation to the next: it carries a counter
// that runs for the life of the process. It is the one part of the output that
// says nothing about the name the author wrote, so it is flattened on both
// sides. Measured the hard way, by a row that passed alone and failed beside
// another file.
const steady = (text) => text.replace(/lambda_[A-Za-z0-9_]+/g, 'lambda_N');

// The columns: every place the dialect has to recognise a name. Each was added
// by a defect, and the comment says which.
const SITES = [
    ['`=` in the script makes state', (n) => script(`${n} = 2\n`)],
    ['`=>` in the script makes a derived', (n) => script(`total = 1\n${n} => total * 2\n`)],
    ['`<=>` in the script makes a bindable', (n) => script(`${n}: str <=> "a"\n`)],
    ['`=` in the markup declares', (n) => markup(`<p>{${n} = 2}</p>`)],
    ['`=>` in the markup declares a derived', (n) => markup(`<p>{${n} => 2}</p>`)],
    ['`:=` in a handler writes through the namespace', (n) => walrus(`lambda: (${n} := 1)`)],
    // A call whose name ends where the parenthesis begins: the decision *call or
    // grouping* read the character before it with `\w`, so `café(x := 1)` was
    // taken for a grouping and rewritten into a name that does not exist.
    ['`:=` inside a call keeps the call', (n) => walrus(`lambda: ${n}(x := 1)`)],
    ['the shorthand expands, so the read goes through the accessor', (n) => markup(`<p {${n}}></p>`)],
    ['a block name is a block name', (n) => markup(`{#each rows as ${n}}{${n}}{/each}`)],
    // Found while reading §3.12: the shorthand of a binding reads a name too.
    // This one failed loudly, Svelte answering `Can only bind to state or
    // props`, because the binding was left for it to resolve.
    ['the shorthand of a binding expands', (n) => markup(`<Child bind:${n} />`)],
    // Silent and wrong rather than loud: `\w+` cannot end immediately before the
    // `(`, so a snippet whose name ends in a non-ASCII letter lost its parameter
    // list, and the body then read a module-level name of the same spelling
    // instead of the argument.
    ['a snippet keeps its parameters', (n) => markup(`{#snippet ${n}(x)}{x}{/snippet}`)],
    // And the name itself, which is what puts the snippet in the enclosing
    // scope: without it `<Card {nóm} />` compiled `nóm` as a free name.
    [
        'a snippet is a name in the scope around it',
        (n) => markup(`{#snippet ${n}(p)}{p}{/snippet}<Card {${n}} />`)
    ],
    // A directive's head is a Python expression the markup pass compiles, so
    // `in:fondés.tw` reaches the module. A head whose name is not ASCII was
    // never found, and the directive reached a name that did not exist.
    ['a dotted directive finds its module', (n) => markup(`<p in:${n}.tw>a</p>`)],
    // `compile.cjs` asked the same question in seven places with one pattern,
    // and six of them read a *JavaScript* name, where ASCII is a defensible
    // line. The seventh read a Python one: what a `.py` exports. So
    // `__all__ = ["élèves"]` was filtered to nothing and the module exported
    // nothing at all, with no error and no warning.
    ['a name in `__all__` is exported', (n) => moduleOf(`__all__ = ["${n}"]\n${n} = 1\n`)],
    ['a function is exported by default', (n) => moduleOf(`def ${n}():\n    return 1\n`)]
];

describe.for(ALPHABETS)('%s is a name', ([, name]) => {
    test.for(SITES)('%s', ([, write]) => {
        expect(steady(write(name))).toBe(steady(write(ASCII)).replaceAll(ASCII, name));
    });
});

// The two refusals that read a name have to recognise the same one, and a
// refusal is not a substitution: what has to match is the sentence.
describe.for(ALPHABETS)('%s, when it is refused', ([, name]) => {
    test.for([
        [
            'an indented `=>` is refused by its own sentence',
            (n) => script(`def go():\n    ${n} => 2\n`),
            /a derived and an effect both belong at the top level/
        ],
        [
            'writing a markup name from a handler is refused',
            (n) => markup(`<p>{${n} = 1}<button onclick={lambda: (${n} := 2)}>x</button></p>`),
            /is declared by the markup/
        ]
    ])('%s', ([, write, sentence]) => {
        expect(() => write(ASCII)).toThrow(sentence);
        expect(() => write(name)).toThrow(sentence);
    });
});
