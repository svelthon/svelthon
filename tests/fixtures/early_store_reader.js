// What a store's cleanup hands JavaScript, beside what its getter reads.
import store from './early_store.svelte.py';
import { add } from './early_store_log.js';

export function record(value) {
    add(`namespace:${value}`, `facade:${store.value}`);
}
