// Python values in JavaScript containers: one the application's transport
// writes, and an object with no prototype, which hold the same list.
import { make } from '#lib/models.py';
import { Ledger } from '#lib/ledger.js';

export function load() {
    const shared = make('shared');

    return {
        ledger: new Ledger([['a', shared.a], ['b', shared.b]]),
        table: Object.assign(Object.create(null), { a: shared.a, whole: shared })
    };
}
