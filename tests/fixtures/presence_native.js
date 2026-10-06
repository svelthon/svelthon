// The same object written in JavaScript: the witness of what `in` reads.
let count = 0;

class Config {
    constructor() {
        this.field = 1;
    }

    get counted() {
        count += 1;
        return 42;
    }

    get raising() {
        count += 1;
        throw new Error('property read');
    }
}

export const config = new Config();
export const reads = () => count;
