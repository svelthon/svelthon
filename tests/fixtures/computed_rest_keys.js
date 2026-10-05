// A computed key that answers otherwise after its first call.
let calls = 0;

export const restart = () => {
    calls = 0;
};

export const key = () => (++calls === 1 ? 'first' : 'second');
