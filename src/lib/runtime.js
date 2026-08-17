// What every compiled component imports. Order is load-bearing: globals, then
// the runtime, then boot.
import './globals.js';
import '../../vendor/brython.js';
import './boot.js';

// Python's None, so a prop the parent never passed reads as None rather than
// leaking JavaScript's undefined into Python.
export const NONE = globalThis.__BRYTHON__.builtins.None;

// Svelte interpolates with String(), and None is an object — it would render as
// "[object Object]". Non-enumerable so nothing that walks the singleton's
// properties can see it. (The same gap remains for lists and dicts, which
// render with JavaScript's stringification rather than Python's str().)
Object.defineProperty(NONE, 'toString', {
    value: () => 'None',
    enumerable: false,
    configurable: true
});

const _b_ = globalThis.__BRYTHON__.builtins;

// Inside a Svelte template you are in JavaScript, not Python — and the two
// disagree. `py` is the bridge, injected into every component that uses
// `<script lang="python">`.
export const py = {
    // JS calls every object truthy, so `{#if items}` would be true for an empty
    // list, an empty dict, or None. Conditions are rewritten to go through this.
    truthy(value) {
        if (value === undefined || value === null) return false;
        // str/int/float/bool are JS primitives in Brython, and there the two
        // languages already agree.
        if (typeof value !== 'object' && typeof value !== 'function') return Boolean(value);
        try {
            return _b_.bool.$factory(value) === true;
        } catch {
            return Boolean(value);
        }
    },

    // Python's str(), for interpolation: `['a', 'b']` rather than `a,b`.
    str(value) {
        if (value === undefined || value === null) return '';
        try {
            return _b_.str.$factory(value);
        } catch {
            return String(value);
        }
    },

    repr(value) {
        try {
            return _b_.repr(value);
        } catch {
            return String(value);
        }
    },

    // Brython keeps an instance's attributes out of the object's JS properties,
    // so `{o.label}` reads undefined on a class instance — dicts and tuples need
    // nothing, but objects do. `py.of(o).label` goes through Python's own
    // attribute lookup, so properties and __getattr__ work too.
    of(value) {
        const $B = globalThis.__BRYTHON__;

        return new Proxy(Object.create(null), {
            get(_target, prop) {
                if (typeof prop !== 'string') return undefined;
                if (prop === 'toString') return () => py.str(value);

                try {
                    return $B.$getattr(value, prop);
                } catch {
                    return undefined;
                }
            }
        });
    }
};

// Rebinding is what propagates, and a mutated container is still the same
// object — Svelte drops a write that === the previous value. Returning a copy
// gives it a new identity, which is the whole point of publish().
export function republish(value) {
    const $B = globalThis.__BRYTHON__;

    if (Array.isArray(value)) return value.slice(); // list
    const cls = $B.get_class(value);
    if (cls === _b_.dict) return _b_.dict.$factory(value);
    if (cls === _b_.set) return _b_.set.$factory(value);

    return value; // scalars already propagate on assignment
}

// A Brython exception reaching JavaScript carries no `message` and no `stack`,
// so devtools and Vite's overlay show nothing at all — the text sits in the
// Python object, where nothing JS looks. Fill both in, keeping the original
// object so Python semantics upstream are untouched.
export function pyError(error, where, lineOffset = 0) {
    const $B = globalThis.__BRYTHON__;

    if (!error || typeof error !== 'object' || error.message !== undefined) return error;

    let described;
    try {
        // Not `cls.__name__`: a Brython class keeps it out of its JS properties,
        // so the lookup has to go through Python's own attribute protocol.
        const name = $B.$getattr($B.get_class(error), '__name__');
        described = `${name}: ${_b_.str.$factory(error)}`;
    } catch {
        described = 'PythonError';
    }

    // The deepest frame is where it actually broke. Line numbers count from the
    // start of the Python source, which for a component begins after its opening
    // <script> tag — hence the offset back to the file's own numbering.
    let line;
    try {
        let tb = $B.$getattr(error, '__traceback__');
        while (tb && tb !== NONE) {
            line = $B.$getattr(tb, 'tb_lineno');
            tb = $B.$getattr(tb, 'tb_next');
        }
    } catch {
        /* pas de traceback exploitable */
    }

    const at = line === undefined ? where : `${where}:${line + lineOffset}`;

    try {
        error.message = `${described} (${at})`;
        if (error.stack === undefined) error.stack = `${error.message}\n    at ${at}`;
    } catch {
        /* exception figée : tant pis, on la relaie telle quelle */
    }

    return error;
}

// Calling an `async def` from JavaScript returns a coroutine that nobody runs:
// the handler appears to do nothing at all, silently. Brython has its own event
// loop, so hand it over.
export function schedule(result) {
    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (!aio || result === undefined || result === null) return result;

    try {
        if ($B.$getattr(aio, 'iscoroutine')(result) === true) {
            $B.$getattr(aio, 'run')(result);
            return undefined;
        }
    } catch {
        /* not a coroutine — hand the value back untouched */
    }

    return result;
}

// A store's namespace, published under its Python module name, so a component's
// own Python can `import counter_store` and reach the very same signals the
// template reads. Without it the bridge would only run one way.
export function registerModule(name, namespace) {
    const $B = globalThis.__BRYTHON__;

    namespace.__name__ = name;
    $B.imported[name] = namespace;
}

// Hand Brython our namespace instead of the one it would have made for itself.
//
// The codegen opens every module body with `locals_X = $B.namespace('X')`, so
// intercepting that single call is enough — no rewriting of generated code.
// The name is checked because a module body may import others while it runs,
// and each import creates its own namespace through the same function.
export function withNamespace(name, namespace, run) {
    const $B = globalThis.__BRYTHON__;
    const original = $B.namespace;

    $B.namespace = (requested) => (requested === name ? namespace : original(requested));

    try {
        return run();
    } finally {
        $B.namespace = original;
    }
}

// Expose one component-level signal as a property of the namespace Brython
// writes into. Values pass through untouched — never wrapped, never proxied —
// which is the point: a Svelte state proxy around a Brython object breaks its
// type machinery (`repr((1, 2))` fails with "requires a 'tuple' object but
// received a 'tuple'"). Reactivity comes from rebinding the signal, not from
// observing the value.
//
// Accessors go on the *prototype*, never on the namespace itself. Rebinding a
// global emits `$B.delete_for_reassign(name, locals)` ahead of the assignment,
// and a plain `delete locals.count` would drop an own accessor for good —
// silently unhooking the signal after the very first write, which is why
// `count = count + 1` stopped propagating while `count += 1` still worked.
// `delete` ignores inherited properties; assignment still runs the inherited
// setter.
export function bind(proto, key, get, set) {
    Object.defineProperty(proto, key, {
        get,
        set,
        enumerable: true,
        configurable: true
    });
}
