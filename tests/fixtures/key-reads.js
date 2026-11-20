// Four rows whose key a getter reads and counts, moved by a test in place.
export const log = { reads: 0 };

const ids = [1, 2, 3, 4];

export const rows = ids.map((_, at) => ({
    get id() {
        log.reads += 1;
        return ids[at];
    }
}));

export const rekey = (at, id) => {
    ids[at] = id;
};

export const reset = () => {
    ids.splice(0, ids.length, 1, 2, 3, 4);
    log.reads = 0;
};
