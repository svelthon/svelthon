// A name only `globals()["x"] = …` binds, read by the template. The template read
// it through the namespace and nothing told it of a change, since a cell is given
// to what the compiler sees bound: the page kept the first value where Python
// held another. A name the module reads and no statement binds has a cell.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { store as heldNamesStore } from './fixtures/store_held_names.svelte.py';
import GlobalsWritten from './fixtures/GlobalsWritten.svelte';
import GlobalsThroughFunctions from './fixtures/GlobalsThroughFunctions.svelte';
import GlobalsBesideStar from './fixtures/GlobalsBesideStar.svelte';
import GlobalsPrototypeNames from './fixtures/GlobalsPrototypeNames.svelte';
import GlobalsWrittenStoreReader from './fixtures/GlobalsWrittenStoreReader.svelte';
import { store as globalsWrittenStore } from './fixtures/globals_written_store.svelte.py';
import GlobalsKeyRead from './fixtures/GlobalsKeyRead.svelte';
import GlobalsBuiltinWritten from './fixtures/GlobalsBuiltinWritten.svelte';
import GlobalsTrueKey from './fixtures/GlobalsTrueKey.svelte';
import GlobalsComputedKey from './fixtures/GlobalsComputedKey.svelte';
import GlobalsBuiltinUpdate from './fixtures/GlobalsBuiltinUpdate.svelte';
import GlobalsHandedBuiltinImport from './fixtures/GlobalsHandedBuiltinImport.svelte';
import GlobalsReservedParam from './fixtures/GlobalsReservedParam.svelte';
import GlobalsReservedKey from './fixtures/GlobalsReservedKey.svelte';
import { store as ghostStarStore } from './fixtures/ghost_star_store.svelte.py';
import { store as ghostMemberStore } from './fixtures/ghost_member_store.svelte.py';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });
    const view = () => {
        flushSync();
        return target.querySelector('[data-k="view"]').textContent;
    };

    return { instance, view };
};

test('the template follows a name only globals() binds', () => {
    const { instance, view } = mounted(GlobalsWritten);
    const first = view();

    instance.write();

    expect([first, view()]).toEqual(['1|6||1', '2|60|7|1']);
});

test('it is followed through a function, a @derived and a =>', () => {
    const { instance, view } = mounted(GlobalsThroughFunctions);
    const first = view();

    instance.write(2);

    expect([first, view()]).toEqual(['1|1|1', '2|2|2']);
});

test('a star import that gives other names changes nothing, and what it gives is followed', () => {
    const { instance, view } = mounted(GlobalsBesideStar);
    const first = view();

    instance.write(2);
    const written = view();

    instance.add();

    expect([first, written, view()]).toEqual(['1|1|7|7|[1]', '2|2|3|3|[1]', "2|2|3|3|[1, 'star']"]);
});

test("a name of JavaScript's prototype is no builtin", () => {
    const { instance, view } = mounted(GlobalsPrototypeNames);
    const first = view();

    instance.write(5);

    expect([first, view()]).toEqual(["1|2|name 'valueOf' is not defined", '5|6|7']);
});

test('a store follows one too, and a name nothing binds stays unbound', () => {
    const { instance, view } = mounted(GlobalsWrittenStoreReader);
    const absent = "name 'missing' is not defined";
    const first = view();

    instance.write(2);

    expect([first, view()]).toEqual([`2|1|1|${absent}`, `4|2|2|${absent}`]);
});

// A name read only at its key, `globals().get("future")`, which no read by its
// name gave a cell: the page kept what it first read.
test('the template follows a name it reads only at its key', () => {
    const { instance, view } = mounted(GlobalsKeyRead);
    const first = view();

    instance.write(2);

    expect([first, view()]).toEqual(['|none', '2|2']);
});

// A builtin the module writes at its key, `globals()["len"] = …`, which the
// template reads by its name: the page kept the builtin's answer.
test('the template follows a builtin the module writes in its globals, and the builtin once it is gone', () => {
    const { instance, view } = mounted(GlobalsBuiltinWritten);
    const first = view();

    instance.write(7);

    const written = view();

    instance.erase();

    expect([first, written, view()]).toEqual(['2', '7', '2']);
});

// A key no statement may bind, `True`, which a dict holds all the same: bound
// by the module beside the builtins it writes, it refused the module.
test('a key no statement may bind is a key of globals() all the same', () => {
    expect(mounted(GlobalsTrueKey).view()).toBe('dictionary entry');
});

// Read in the template at a key computed, or at a key written out by `.get`,
// whose dot the template rewrites: the page kept what it first read.
test('the template follows a key it reads computed, and one it reads by .get', () => {
    const { instance, view } = mounted(GlobalsComputedKey);
    const first = view();

    instance.write(9);

    expect([first, view()]).toEqual(['pending|pending', '9|9']);
});

// A builtin installed by `update`, which no key written out names.
test('the template follows a builtin globals().update() installs', () => {
    const { instance, view } = mounted(GlobalsBuiltinUpdate);
    const first = view();

    instance.write(9);

    expect([first, view()]).toEqual(['2', '9']);
});

// The namespace handed on binds every builtin the module reads, but not one it
// imports from JavaScript, which is no builtin there: bound, it refused the
// module.
test('a builtin name imported from JavaScript is left as it is beside globals() handed on', () => {
    expect(mounted(GlobalsHandedBuiltinImport).view()).toBe('3|javascript max of 2');
});

// Nor a name JavaScript reserves, `eval`, read as a parameter beside globals()
// handed on, or written as a key: bound, it refused the module.
test('a name JavaScript reserves is left as it is beside globals() handed on or written', () => {
    expect([mounted(GlobalsReservedParam).view(), mounted(GlobalsReservedKey).view()]).toEqual(['value', 'metadata']);
});

// A name the module reads at its key, beside a star import or a test of
// membership, which neither binds: it was a key of the store.
test('a store publishes no name it only reads at its key', () => {
    expect([
        ['ghost' in ghostStarStore, Object.keys(ghostStarStore).includes('ghost'), ghostStarStore.report()],
        ['ghost' in ghostMemberStore, Object.keys(ghostMemberStore).includes('ghost'), ghostMemberStore.report()]
    ]).toEqual([
        [false, false, 'stock|absent'],
        [false, false, 'stock|False']
    ]);
});

// A store with no `__all__` publishes the names it has, and a name it only reads
// is none of them: `missing` was a key of the store, where Python's `hasattr`
// is false. The name only `globals()` binds is one of them.
test('a store publishes no name that nothing binds', () => {
    expect(['missing' in globalsWrittenStore, 'future' in globalsWrittenStore, Object.keys(globalsWrittenStore).includes('missing')]).toEqual([false, true, false]);
});

// Nor a name its module does not hold, as Python's `hasattr` answers: one only
// annotated, one deleted, the variable of a comprehension of its own.
test('a store publishes no name its module does not hold', () => {
    const names = ['note', 'deleted', 'value', 'last', 'squares', 'kept'];

    expect(names.filter((name) => name in heldNamesStore)).toEqual(['last', 'squares', 'kept']);
    expect(Object.keys(heldNamesStore).sort()).toEqual(['kept', 'last', 'squares']);
});
