// @vitest-environment node
//
// The server half of the deleted derived of `early-cleanup-props.test.js`: a
// server keeps the first value a derived read, and a store's getter read off
// the derived handed it on once the name was deleted. Read through the
// namespace, the name is gone.
import { test, expect } from 'vitest';

test("a server reads a store's deleted derived as nothing", async () => {
    const { store } = await import('./fixtures/deleted_derived_store.svelte.py');
    const read = [store.value];
    store.drop();
    read.push(store.value);

    expect(read).toEqual([14, undefined]);
});
