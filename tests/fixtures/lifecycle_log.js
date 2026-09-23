// A journal the fixtures write from Python without adding a dependency.
export const events = [];
export const record = (value) => events.push(value);
