// A registry a Python component hands its callback to through `importjs`, the
// position that is a library call rather than a prop.
const held = new Set();

export const register = (fn) => {
    held.add(fn);
    return held;
};
