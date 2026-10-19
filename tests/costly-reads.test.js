// **A name whose read runs code is read where Python reads it**: a snippet's
// default, a name a pattern unpacks, a derived. Handed to the expression ahead,
// it ran before what the expression reads to its left, `{first() + ":" + x}`
// running `x`'s default before `first()`; and the write half of a binding read
// it ahead too, so `bind:value={bag[0 if True else x]}` ran the default a
// branch excluded, raised, and lost what was typed. The order and the answers
// are CPython's, and Svelte's in production.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { pythonExpressions, collector } from '../src/lib/markup.js';
import '../src/lib/compile.cjs';
import ReadOrder from './fixtures/ReadOrder.svelte';
import ReadOrderParent from './fixtures/ReadOrderParent.svelte';
import BoundBranch from './fixtures/BoundBranch.svelte';
import { seen } from './fixtures/read_order.js';
import { scriptSurface } from '../src/lib/compile.js';
import { runningNames } from '../src/lib/expressions.js';

test.for([
    ['default', 'first@1:second@2', ['first', 'second']],
    // In the order the body reads them, `y` first, and not the parameters'.
    ['two defaults', 'first@1:second@2', ['first', 'second']],
    // Read first, a derived of the script runs its body first, and a prop what
    // its parent wrote for it, where `x` read ahead ran its default before.
    ['derived', 'first@1:second@2', ['first', 'second']],
    ['prop', 'first@1:second@2', ['first', 'second']]
])('a default is read in the order the expression reads it: %s', ([kind, shown, order]) => {
    const target = document.body.appendChild(document.createElement('div'));

    seen.length = 0;
    mount(kind === 'prop' ? ReadOrderParent : ReadOrder, { target, props: { kind } });
    flushSync();

    expect([target.querySelector('output').textContent, [...seen]]).toEqual([shown, order]);
});

test.for(['if', 'and'])('a binding whose target skips a default writes what is typed: %s', ([kind]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(BoundBranch, { target, props: { kind } });
    flushSync();

    const input = target.querySelector('input');

    input.value = 'new';
    input.dispatchEvent(new Event('input'));
    flushSync();

    expect(target.querySelector('output').textContent).toBe('new');
});

// **Read before anything runs, such a name is read ahead**: its read runs
// first there too, as in Python, and a call for each read cost every row a
// snippet renders a fifth of its update. A snippet's parameter, handed late
// (`_late`) in each expression and binding of its body, or ahead, in Python's
// order of evaluation. The script's `total` and `label` run code when read, a
// derived and a prop (`runningNames`); its `fmt` does not.
const handedLate = (body) => {
    const defs = [];
    const markup = `{#snippet line(x)}${body}{/snippet}`;
    const runs = (name) => ['total', 'label'].includes(name);

    pythonExpressions(markup, collector(defs), undefined, { filename: 'Line.svelte', content: markup, offset: 0, runs });

    return defs.map((one) => /^def __expr_\w*_late\(/.test(one));
};

test.for([
    ['an item of it', '{x["n"] * 2}', [false]],
    ['an argument', '{fmt(x)}', [false]],
    ['an argument of a builtin', '{len(x)}', [false]],
    ['after a derived is read', '{":".join([total, x])}', [true]],
    ['after a prop is read', '{label + x}', [true]],
    ['the right operand of a constant', '{"#" + x}', [false]],
    ['the test of a conditional', '{x["a"] if x else 0}', [false]],
    ['a method of a constant', '{", ".join(x)}', [false]],
    ["a lambda's default", '{(lambda y=x: y)()}', [false]],
    ['the owner of a bound item', '<input bind:value={x["label"]}>', [false, false]],
    ['after a call', '{first() + x}', [true]],
    ['in a branch', '{"a" if c else x}', [true]],
    ['after a method is read', '{a.b(x)}', [true]],
    ['past a first comparison', '{1 < 2 < x}', [true]],
    ['after a merge', '{f(**m, k=x)}', [true]],
    ['after an unpacked argument', '{f(k=x, *m)}', [true]],
    ["in a lambda's body", '{(lambda: x)()}', [true]],
    ["in a comprehension's body", '{[x for _ in rows]}', [true]],
    ["past a set's first item", '{ {1, x} }', [true]],
    ["in a bound item's branch", '<input bind:value={bag[0 if c else x]}>', [true, true]],
    // Written, the value is unpacked before it is read; read, it comes first.
    ['in a target that unpacks', '<input bind:value={(x["a"], y)}>', [true, false]]
])('a snippet parameter is read ahead only where Python reads it first: %s', ([, body, late]) => {
    expect(handedLate(body)).toEqual(late);
});

// What the script says runs code when read: a derived, a prop and a bindable
// one. Not a function, a state, a class or what JavaScript brings in.
test("a script's names whose read runs code are its deriveds and props", () => {
    const script = [
        'importjs {first} from "./read_order.js"',
        'label: object = None',
        'shared: list = bindable()',
        'total => first()',
        'count = 0',
        'def fmt(v):',
        '    return v',
        'class Box:',
        '    pass'
    ].join('\n');

    expect(runningNames(scriptSurface(script)).sort()).toEqual(['label', 'shared', 'total']);
});
