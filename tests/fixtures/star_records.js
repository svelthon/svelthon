// What the hooks of `star_hooks.py` say they ran, read by the tests.
export const records = [];

export const record = (line) => {
    records.push(line);
};

export const reset = () => {
    records.length = 0;
};
