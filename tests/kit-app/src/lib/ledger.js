// A container of the application's own, which its transport writes and makes
// again (`hooks.py`): a Map with a method of its own.
export class Ledger extends Map {
    label() {
        return `ledger:${this.size}`;
    }
}

export const transport = {
    Ledger: {
        encode: (value) => value instanceof Ledger && [...value],
        decode: (entries) => new Ledger(entries)
    }
};
