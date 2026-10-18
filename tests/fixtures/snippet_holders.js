// JavaScript objects a Python child keeps a snippet in, read back by the dot:
// a field, a getter, a field of a field.
export const box = (fn) => ({ fn });
export const getter = (fn) => ({
    get fn() {
        return fn;
    }
});
export const nested = (fn) => ({ inside: { fn } });
