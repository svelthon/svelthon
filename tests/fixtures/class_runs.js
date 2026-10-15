// What an effect saw at each of its runs, kept outside the component, so that
// keeping it is no read of the effect's own.
export const runs = [];

export const log = (one) => {
    runs.push(one);
};

export const count = () => runs.length;
