// A constant and a function returning the same number. They used to reach
// Python with different capabilities: the call went through the conversion and
// the constant did not.
export const half = 0.5;

export const getHalf = () => 0.5;

export const big = 2 ** 60;
