// A `load()` the module binds again at its first call: SvelteKit reads the
// module's export at each request, and serves the next one the `load` bound
// then.
let load = first;

function first() {
    load = second;
    return { turn: 'first' };
}

function second() {
    return { turn: 'second' };
}

export { load };
