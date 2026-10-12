// A reactive module hands JavaScript its names through an object it exports as
// `store`, which was declared under that name too: a module with a name of its
// own spelled `store`, a value, a derived or a function, declared it twice, and
// Svelte refused the module. The object is the compiler's, under a name of the
// compiler's, and `store` is the module's object as JavaScript imports it; the
// module's own `store` is its member, and what Python imports.
import { test, expect } from 'vitest';
import value, * as valueModule from './fixtures/facade_value.svelte.py';
import derived from './fixtures/facade_derived.svelte.py';
import named, * as namedModule from './fixtures/facade_function.svelte.py';
import { read } from './fixtures/facade_reader.py';

test('a reactive module may have a name of its own spelled store', () => {
    expect([value.store, derived.store, named.store()]).toEqual([7, 7, 7]);
    expect(read()).toEqual([7, 7, 7]);

    // `store` by name is the module's object, the function its member.
    expect([valueModule.store, namedModule.store]).toEqual([value, named]);
});
