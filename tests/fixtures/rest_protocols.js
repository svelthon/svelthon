// JavaScript rows whose `ob_type` is a getter of the author's: one that refuses
// to run, not enumerable, and one that counts its reads, enumerable.
export const reads = { counted: 0 };

const refusing = { first: 10, tail: 20 };
Object.defineProperty(refusing, 'ob_type', {
    enumerable: false,
    get() {
        throw new Error('ob_type getter executed');
    }
});

const counting = { first: 10, tail: 20 };
Object.defineProperty(counting, 'ob_type', {
    enumerable: true,
    get() {
        reads.counted += 1;
        return 'business';
    }
});

export const rows = { refusing, counting };
