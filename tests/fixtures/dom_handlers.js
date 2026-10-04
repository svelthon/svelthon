// A JavaScript handler that reads the receiver Svelte calls it with.
export const seen = [];

export function receiver(event) {
    seen.push(this === event.currentTarget);
}
