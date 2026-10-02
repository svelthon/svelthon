// A JavaScript library on the other side of a Python call, in the two shapes
// that read something other than an argument's contents.
//
// A registry that recognises a listener by identity — which is every
// `removeEventListener`, `off`, `unsubscribe` and deduplicating registry there
// is — and a function that compares the two arguments it was handed.
const target = new EventTarget();

export const on = (fn) => target.addEventListener('ping', fn);
export const off = (fn) => target.removeEventListener('ping', fn);
export const ping = () => target.dispatchEvent(new Event('ping'));

// Writes through the first argument and reads through the second: two names for
// one Python list have to be two names for one array on this side.
export function alias(a, b) {
    a.push(1);

    return { same: a === b, observed: b.length };
}

// The control for that one: the same graph arriving inside a single argument,
// where the sharing was never lost.
export const aliasBundle = (pair) => alias(pair[0], pair[1]);

// Where a library puts its callbacks. Each is called with an argument the Python
// function never declared, which is what the adaptation is for: a wrapper trims
// the call to the signature, a bare Python function raises on it.
export const direct = (fn) => fn('event');
export const nested = (options) => options.done('event');
export const listed = (fns) => fns[0]('a') + fns[1]('b');

// The same options object, behind an await: the policy has to survive the
// crossing of a promise, not only the crossing of a container.
export const delayed = async (options) => (await options).done('event');

// Hands back what it was given, as a library keeping a value for later does.
export const back = (value) => value;

// Calls whatever it was handed, and says what JavaScript thinks it is. A Python
// callable that is not a JavaScript function fails here before its body runs.
export const invoke = (fn) => fn('event');
export const kindOf = (fn) => typeof fn;

// One Python function reached by two routes in one argument.
export const same = (options) => options.a === options.list[0];

// And the registry again, entered and left through an options object.
export const onOptions = (options) => target.addEventListener('ping', options.handler);
export const offOptions = (options) => target.removeEventListener('ping', options.handler);
