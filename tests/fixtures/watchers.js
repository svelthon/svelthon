// How many components are still subscribed to the store's list. Read from
// JavaScript because the marker is a property on the container itself, and a
// Python list handed to a JavaScript function crosses as a copy.
import store from './leak_store.svelte.py';

export function watchers() {
    return store.rows?.$notify?.bumps.length ?? -1;
}
