// The transitions `HeldTransitions.svelte` and its witness play, by element
// and direction.
export const played = [];

export function record(node, params, options) {
    played.push(`${node.dataset.k}:${options.direction}`);
    return {};
}
