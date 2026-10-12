// What the root of `root_retry.svelte.py` records when it runs, kept out of
// the module so recording reads nothing the root follows.
export const runs = [];
export const record = (value) => runs.push(value);
