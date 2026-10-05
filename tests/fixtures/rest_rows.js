// Rows a JavaScript library hands over: a plain record and a class instance.
export class Record {
    constructor() {
        this.first = 10;
        this.tail = 20;
    }

    describe() {
        return 'record';
    }
}

export const records = [{ first: 10, tail: 20 }, new Record()];
