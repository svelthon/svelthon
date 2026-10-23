// A Python child re-exported under a query, which only the child's own module
// can tell is Python, and under one that holds both quotes.
export { default as Child } from './HeldPriceChild.svelte?variant=reexport';
export { default as Quoted } from './HeldPriceChild.svelte?variant="it\'s"';
