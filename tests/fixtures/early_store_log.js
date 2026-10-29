// What `early_store_reader.js` records, in a module of its own, loaded first.
export const events = [];

export function add(...rows) {
    events.push(...rows);
}
