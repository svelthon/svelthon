// What a `load()` written in JavaScript keeps from one request to the next,
// empty at first, then holding Python values: walked as it is at each return.
import { make } from '#lib/models.py';

const store = { items: [] };

export function load({ url }) {
    if (url.searchParams.has('fill') && store.items.length === 0) store.items.push(make('lossy'), make('bumped'));
    return store;
}
