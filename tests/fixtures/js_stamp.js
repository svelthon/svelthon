// What a library does when it builds a value for a framework to recognise
// later: SvelteKit's `query()` and `command()` return a function carrying the
// marks their plugin checks for.
export function stamp(fn) {
    const made = (...args) => fn(...args);
    made.built_by = 'js_stamp';
    return made;
}
