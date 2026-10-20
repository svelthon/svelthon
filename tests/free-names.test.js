// **A template expression is handed the names it reads from outside itself,
// as CPython scopes them**: a lambda's parameters and a comprehension's targets
// are its own, and a snippet's parameter of the same name is not read for it.
// Handed every word of its text, `{(lambda x: x)(7)}` in `{#snippet card(x =
// fail())}` read `x` before it ran, and the default with it: the component
// failed to mount on `fail()`, where Svelte, in production, reads nothing. A
// lambda's default and a comprehension's first iterable are read where they
// are written, and still hand the name in.
//
// The answers are CPython's, each expression run with `x` looked up from
// outside it and recorded.
import { test, expect } from 'vitest';
import { pythonExpressions, collector } from '../src/lib/markup.js';
// The parser the names an expression reads are read with, which the plugin
// has loaded before any markup is read.
import '../src/lib/compile.js';

const handed = (expression) => {
    const defs = [];

    pythonExpressions(`{#snippet card(x=fail())}<output>{${expression}}</output>{/snippet}`, collector(defs));

    return /^def __expr_1(?:_late)?\(x\):/.test(defs.at(-1));
};

test.for([
    ['(lambda x: x)(7)', false],
    ['[x for x in [7]][0]', false],
    ['next(x for x in [7])', false],
    ['(lambda **x: 7)()', false],
    ['{x: 1 for x in [7]}[7]', false],
    ['[y for y in [1] for x in [y]][0]', false],
    ['(lambda x:\n x)(7)', false],
    ['[x for x in [7]][0]\n+ 0', false],
    ['x', true],
    ['(lambda y=x: y)()', true],
    ['(lambda x=x: x)()', true],
    ['(lambda y: x)(0)', true],
    ['[x for x in x][0]', true],
    ['[y for y in [1] if x][0]', true],
    ["f'{x}'", true]
])('%j reads x from outside itself: %s', ([expression, reads]) => {
    expect(handed(expression)).toBe(reads);
});
