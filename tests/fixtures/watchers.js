// How many components are still subscribed to the store's list. Read from
// JavaScript because a Python list handed to a JavaScript function crosses as a
// copy, and the marker is held outside the container, in the runtime's WeakMap.
import { marks } from '../../src/lib/runtime.js';
import store from './leak_store.svelte.py';

export function watchers() {
    return marks(store.rows)?.bumps.length ?? -1;
}
