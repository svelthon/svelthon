// An action a component imports in its module script, which keeps what it was
// given, and hands it back.
let kept;

export const keep = (node, value) => {
    kept = value;
};

export const back = () => kept;
