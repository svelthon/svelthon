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

    // `{#each}` walks a JavaScript array. A Python list or tuple already is one,
    // but a dict, a set, a range, a generator or the result of .items() is not —
    // and iterating those is the whole point of writing the loop in Python.
    seq(value) {
        if (Array.isArray(value)) return value;
        if (value === undefined || value === null) return [];

        try {
            return _b_.list.$factory(value);
        } catch (error) {
            // A foreign JavaScript iterable — a NodeList from bind:this — is not
            // Python's to convert, but Svelte can still walk it.
            if (value && typeof value[Symbol.iterator] === 'function') return value;
            throw error;
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

// Methods that change a container. `__setitem__` and `__delitem__` are not
// here: Brython compiles `d[k] = v` and `del d[k]` to their own calls, caught
// below.
const MUTATORS = new Set([
    'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'sort', 'reverse',
    'add', 'discard', 'update', 'setdefault', 'popitem', 'appendleft',
    'extendleft', 'popleft', 'rotate', 'intersection_update',
    'difference_update', 'symmetric_difference_update'
]);

// Make an in-place mutation reactive — `items.append(x)` with nothing after it.
//
// Svelte's own answer is to proxy the value in depth, which is unusable here: a
// Python object behind a JavaScript proxy fails Brython's own type checks
// (`repr((1, 2))` raises "requires a 'tuple' object but received a 'tuple'").
//
// A Python list *is* a JavaScript array, so the object itself can carry a
// non-enumerable marker instead — `$B.get_class` reads only `ob_type`, so
// `type(items) is list` stays true, `repr` is untouched, and nothing that walks
// the value can see the marker. Brython compiles every method call to
// `$B.call_attr` and every indexed write to `$B.$setitem`, so two interceptions
// cover the whole language, and an unmarked object pays one property miss.
//
// The marker travels with the object: a list handed to a helper that mutates it
// deep inside a function still notifies, which no static analysis could do.
function installMutationTracking($B) {
    if ($B.$svelthonTracking) return;
    $B.$svelthonTracking = true;

    const notify = (obj) => {
        if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined) obj.$notify();
    };

    // Rest arguments rather than `arguments` + apply: these three sit on the
    // hottest path Brython has, and the old form blocks V8's optimiser.
    const callAttr = $B.call_attr;
    $B.call_attr = function (obj, attr, ...rest) {
        const result = callAttr(obj, attr, ...rest);
        if (MUTATORS.has(attr)) notify(obj);
        return result;
    };

    const setitem = $B.$setitem;
    $B.$setitem = function (obj, ...rest) {
        const result = setitem(obj, ...rest);
        notify(obj);
        return result;
    };

    const delitem = $B.$delitem;
    $B.$delitem = function (obj, ...rest) {
        const result = delitem(obj, ...rest);
        notify(obj);
        return result;
    };
}

installMutationTracking(globalThis.__BRYTHON__);

// Only a container can be mutated in place; a scalar propagates by rebinding,
// which the accessor already handles.
function mutable(value) {
    if (value === null || value === undefined || typeof value !== 'object') return false;
    if (Array.isArray(value)) return true; // list — a tuple is one too, and immutable

    try {
        const cls = globalThis.__BRYTHON__.get_class(value);
        return cls === _b_.dict || cls === _b_.set;
    } catch {
        return false; // a foreign JavaScript value is not ours to mark
    }
}

// Attach `bump` to the value stored under a module-level name. One object may
// be bound to two names; both are then told.
export function track(value, bump) {
    if (!mutable(value)) return value;

    const marker = Object.getOwnPropertyDescriptor(value, '$notify');
    if (marker) {
        if (!marker.value.bumps.includes(bump)) marker.value.bumps.push(bump);
        return value;
    }

    const bumps = [bump];
    const fire = () => {
        for (const one of bumps) one();
    };
    fire.bumps = bumps;

    Object.defineProperty(value, '$notify', {
        value: fire,
        enumerable: false,
        configurable: true
    });

    return value;
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
export function schedule(result, where, lineOffset = 0) {
    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (!aio || result === undefined || result === null) return result;

    // Compared in JavaScript rather than through aio.iscoroutine(): this runs on
    // every call into Python, template expressions included, and a Brython call
    // here costs more than the check saves.
    if ($B.get_class(result) !== $B.coroutine) return result;

    // run(coro, onsuccess, onerror). Its default onerror only logs, so an
    // exception raised inside a coroutine reaches nothing at all — no error
    // event, no overlay. Rethrowing from a timeout turns it into a genuine
    // uncaught error, the way the synchronous path already behaves.
    $B.$getattr(aio, 'run')(
        result,
        () => $B.leave_frame(), // what Brython's own default does
        (error) => {
            setTimeout(() => {
                throw pyError(error, where, lineOffset);
            });
        }
    );

    return undefined;
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
