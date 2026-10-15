// The model a component handed over, read again by its test after a mount that
// may have failed.
let kept;

export const keep = (one) => {
    kept = one;
};

export const held = () => kept;
