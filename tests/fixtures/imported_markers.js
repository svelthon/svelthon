// A library whose function happens to carry a marker's name.
export const seen = [];

export const inspect = (value) => {
    seen.push(value);

    return value + 1;
};
