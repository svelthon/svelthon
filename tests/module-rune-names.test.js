// A `<script module>` binding a rune's name has it held under another variable
// (`holdRunes`), its export and its reads the author's. A declaration
// TypeScript makes a value of, an `enum`, a namespace, an `import … =`, kept the
// name as written where its export and its reads were held: the build was
// refused, or the page stopped before rendering; and a namespace's body, never
// read, read the module's `state` under the old name. And what JavaScript names
// a function or a class after its binding, `.name`, was the variable's.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';

const shown = async (path, selector) => {
    const { default: Component } = await import(path);
    const target = document.body.appendChild(document.createElement('div'));

    mount(Component, { target });
    flushSync();

    const text = target.querySelector(selector).textContent;

    target.remove();
    return text;
};

test.for([
    ['an exported enum', './fixtures/typescript/ModuleEnum.svelte', '7|8|1'],
    ['an enum kept to the module', './fixtures/typescript/ModuleEnumPrivate.svelte', '7|1'],
    ['namespaces', './fixtures/typescript/ModuleNamespace.svelte', '8|7|own|1'],
    ['import aliases', './fixtures/typescript/ModuleImportEquals.svelte', '9|9|7|1'],
    ['functions behind what it erases', './fixtures/typescript/ModuleRuneAssigned.svelte', 'state|effect|inspect|1']
])('a TypeScript module script declaring %s named like a rune renders', async ([, path, expected]) => {
    expect(await shown(path, 'output')).toBe(expected);
});

// And one assigned to such a name, by `=`, `??=` or a default of a pattern, is
// named after it where it is evaluated: given back behind declarations alone,
// it kept `__brycomp_svelthon_state`. One that names itself keeps its own, and a
// function's local is no binding held.
test('a function or a class assigned to a name like a rune takes that name', async () => {
    const module = await import('./fixtures/ModuleRuneAssigned.svelte');

    expect(await shown('./fixtures/ModuleRuneAssigned.svelte', 'p')).toBe('state|derived|effect|inspect|props|own|state|1');
    expect([module.state.name, module.derived.name, module.inspect.name, module.props.name]).toEqual(['state', 'derived', 'inspect', 'props']);
});

// Given back through the bridge: `Object.defineProperty` read the module's own
// `Object`, and the component did not render. A class's before any static code
// of its own: given back behind its declaration, a static field read
// `__brycomp_svelthon_state`, and a `static ['name']` was written over. And never over
// a static method or accessor `name` of the author's, by whatever key.
test('a function or a class named like a rune keeps its name, read before its declaration and while it is made too', async () => {
    const module = await import('./fixtures/ModuleRuneNames.svelte');

    expect(await shown('./fixtures/ModuleRuneNames.svelte', 'p')).toBe('derived|state|derived|effect|Caption|own|catalog|1');
    expect([module.state.name, module.derived.name, module.effect.name]).toEqual(['state', 'derived', 'effect']);
    expect(await shown('./fixtures/ModuleRuneClassInit.svelte', 'p')).toBe('state|true|custom|custom|explicit|accessor|method|host|host|computed|computed|1');
});
