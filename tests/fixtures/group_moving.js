// A value that answers anew at each call, as an id generator does, for
// `GroupHydrateMoving.svelte` and its witness.
let count = 0;

export function next_value() {
    count += 1;
    return String(count);
}
