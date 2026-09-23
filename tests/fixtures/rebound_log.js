// What the effects of `Rebound.svelte` saw, written from JavaScript so the log
// adds no dependency of its own.
export const events = [];
export const record = (value) => events.push(value);
export const oldEvents = [];
export const recordOld = (value) => oldEvents.push(value);
