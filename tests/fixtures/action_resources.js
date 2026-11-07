// The resources the actions of `ActionDictLive.svelte` and its witness hold:
// taking one registers it, and what it hands back releases it.
export const held = new Set();

export function acquire(value) {
    const name = `resource ${value}`;

    held.add(name);
    return () => held.delete(name);
}
