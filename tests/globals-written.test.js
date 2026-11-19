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
