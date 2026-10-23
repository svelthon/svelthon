// **A type the module script imports is no component.** `import type Child
// from "./Child.svelte"` binds no `Child` at run time, so the component the
// instance is handed under that name is the one its props cross for. The
// type's file was read as the child's: a JavaScript child handed under a
// Python child's type was given a Python float, `object:[object Object]`,
// and a Python child under a JavaScript child's type lost its `Price`.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TypeImportsPython from './fixtures/TypeImportsPython.svelte';
import TypeImportsJs from './fixtures/TypeImportsJs.svelte';
import TypedChildPython from './fixtures/TypedChildPython.svelte';
import TypedChildJs from './fixtures/TypedChildJs.svelte';

test.for([
    ['a Python child', 'a JavaScript one', 'number:1', TypeImportsPython, TypedChildJs, 'whole'],
    ['a Python child', 'a JavaScript one', 'number:0.5', TypeImportsPython, TypedChildJs, 'price'],
    ['a JavaScript child', 'a Python one', 'float:1.0', TypeImportsJs, TypedChildPython, 'whole'],
    ['a JavaScript child', 'a Python one', 'Price:0.5', TypeImportsJs, TypedChildPython, 'price']
])('a type imported from %s, handed %s, crosses props as the child handed: %s', ([, , shown, Parent, Child, kind]) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Parent, { target, props: { ByDefault: Child, ByName: Child, Inline: Child, kind } });
    flushSync();

    expect([...target.querySelectorAll('output')].map((one) => one.textContent)).toEqual([shown, shown, shown]);
});
