// A store's function marked `@export`, as a component's is: the store
// publishes it as it publishes every function, and the module the marker
// compiles to loads. Marked in a store, it would have its runtime imported a
// second time beside the store's own, which an ES module refuses.
import { test, expect } from 'vitest';
import * as exported from './fixtures/export_marked_store.svelte.py';

test('a store publishes a function marked @export, as any other', () => {
    expect([exported.bump(), exported.bump()]).toEqual([1, 2]);
});
