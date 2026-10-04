// Functions a call hands back to Python: a formatter, one that calls the
// callback it is given, and one a library has marked.
export const decimal = (value) => value.toFixed(2);
export const factory = () => decimal;
export const objectFactory = () => ({ decimal });
export const many = (callback) => callback(0.25);
export const callbackFactory = () => many;

export const MARKED = Object.assign((value) => value, { __: { type: 'query' } });
export const marked = () => MARKED;

export const same = (one) => one === decimal;
export const checker = () => ({ same });
