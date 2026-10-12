// Two decorators of a library, under the names of two markers: each hands back
// the function it is given, and runs nothing.
export const derived = (fn) => fn;
export const effect = (fn) => fn;
