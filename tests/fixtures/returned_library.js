// A library that hands back what it is given, by a named export and through an
// object holding the same function.
export const identity = (value) => value;
export const holder = { identity };
