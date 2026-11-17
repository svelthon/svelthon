// Two modules it re-exports all of, each with a `load` of its own, two bindings
// of one function: JavaScript exports neither, the name being ambiguous, and
// SvelteKit runs none.
export * from './first.js';
export * from './second.js';
