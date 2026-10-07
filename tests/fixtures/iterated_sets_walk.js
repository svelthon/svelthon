// What JavaScript does with a Python value it is handed by Python: walks it,
// adds to it, reads it.
export const spread = (value) => [...value];

export const read = (value, key) => value[key];

export const size = (set) => set.size;

export const holds = (set, one) => set.has(one);

export const text = (value) => String(value);

export const each = (value) => {
    const rows = [];

    value.forEach((one) => rows.push(one));

    return rows;
};

export const put = (set, value) => set.add(value);
