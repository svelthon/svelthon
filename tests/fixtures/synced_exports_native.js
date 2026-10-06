// The same module written in JavaScript: the witness of what an importer reads.
class Thing {
    constructor() {
        this.count = 0;
    }

    double() {
        return this.count * 2;
    }
}

export const items = [0];
export const record = { count: 0 };
export const nested = { items: [0] };
export const rows = [0];
export const table = { count: 0 };
export const thing = new Thing();

export function mutate() {
    items.push(1);
    record.count = 1;
    nested.items.push(1);
    rows.push(1);
    table.count = 1;
    thing.count = 1;
}

export function seen() {
    return { items: [...items], record: { ...record }, thing: thing.count };
}
