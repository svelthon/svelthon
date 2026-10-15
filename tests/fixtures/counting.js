// Counters the functions of a fixture advance and its test reads, kept out of
// the component, so that counting is no change of its own state.
export const seen = { keys: 0, rows: 0 };

export function count(name) {
    seen[name] += 1;
}

export function reset() {
    seen.keys = 0;
    seen.rows = 0;
}
