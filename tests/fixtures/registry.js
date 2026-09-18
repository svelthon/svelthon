// A registry that knows a callback by its identity and nothing else, which is
// every `off`, `unsubscribe` and deduplicating set there is. A real `Set`, so
// what it measures is JavaScript's own idea of *the same function*.
const handlers = new Set();

export const on = (fn) => handlers.add(fn);
export const off = (fn) => handlers.delete(fn);
export const size = () => handlers.size;
export const answers = () => [...handlers].map((fn) => fn());
export const clear = () => handlers.clear();

// What a listener that was never removed goes on doing, which is the half of the
// defect a count cannot show.
export const emit = (value) => handlers.forEach((fn) => fn(value));
