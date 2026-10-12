// What the roots of `root_early.svelte.py` record when they run, kept out of
// the module so recording reads nothing the roots follow.
export const runs = [];
export const record = (value) => runs.push(value);
