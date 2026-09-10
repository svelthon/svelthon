// What every compiled component imports. Order is load-bearing: globals, then
// the runtime, then boot.
import './globals.js';
import '../../vendor/brython.js';
import '../../vendor/sys.js';
import './boot.js';
import { createSubscriber } from 'svelte/reactivity';

// Python's None, so a prop the parent never passed reads as None rather than
// leaking JavaScript's undefined into Python.
export const NONE = globalThis.__BRYTHON__.builtins.None;

// The template helpers, re-exported so a generated component has one specifier
// to import rather than two, and so every satellite repo keeps the single
// `svelthon/runtime` alias it already resolves.
//
// The cycle is deliberate and safe: `helpers.js` reads `NONE`, `__pybridge`,
// `ticking`, `plainData` and `pyData` from here, but only from inside function
// bodies, so nothing is touched while either module is still evaluating.
export { helpers } from './helpers.js';

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
// disagree. This is the bridge behind `__truthy`, `__text`, `__seq` and
// `__spread`, the four names a compiled template expression actually calls.
//
// It was called `py` while a template's expressions were still JavaScript and an
// author wrote `py.str(items)` in the markup — short, on purpose, because it was
// typed by hand. Nothing types it now but generated code, so the short name was
// pure cost: it occupied `py` in every component's scope, and had to be kept out
// of reach through JS_RESERVED for that reason alone.
export const __pybridge = {
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
    //
    // None renders as nothing, like null and undefined beside it. In a template
    // the default failure is absence — not an error, and not printing a word
    // that means nothing to whoever is reading the page. `str(None)` is still
    // "None" in the script, where a developer is the reader; this is the markup,
    // where they are not. Svelte renders null and undefined as empty for the
    // same reason, and a prop the parent never passed arrives here as None.
    str(value) {
        if (value === undefined || value === null || value === NONE) return '';
        try {
            return _b_.str.$factory(value);
        } catch {
            return String(value);
        }
    },

    // A JavaScript array handed back to Python. A list *is* an array in Brython,
    // but not every array is a list: one built here — by `.slice()`, say — reads
    // as a `JavascriptArray`, which prints `[A, B]` where Python prints
    // `['A', 'B']`. Anything a helper hands to Python goes through this.
    list(items) {
        return _b_.list.$factory(items);
    },

    // `{#each}` walks a JavaScript array. A Python list or tuple already is one,
    // but a dict, a set, a range, a generator or the result of .items() is not —
    // and iterating those is the whole point of writing the loop in Python.
    seq(value) {
        if (Array.isArray(value)) {
            // Hand the watch down to the rows: {#each} walks the array in
            // JavaScript, never through $getitem, so this is the only path by
            // which an item can come under watch before its block reads it.
            if (value.$notify !== undefined) {
                for (const item of value) inherit(value, item);
            }

            return value;
        }
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

    // What Python hands *out* to a DOM boundary — a `bind:`, and an attribute
    // or prop written `href={value}`. Python's None is an object, so Svelte
    // would write it straight through: an `<input>` shows the word "None",
    // `href` becomes the string "None", and `bind:files` fails outright with
    // `Failed to convert value to FileList`. Undefined is what JavaScript means
    // by "nothing here yet" — Svelte drops an attribute set to it, and its own
    // bindings expect it.
    //
    // Only None. Zero, an empty string and False are values a binding must keep.
    bound(value) {
        return value === NONE ? undefined : value;
    },

    // `{...attrs}` — Svelte diffs the spread object against the one from the
    // previous render, and a dict mutated in place *is* the same object. In
    // JavaScript the problem does not arise: spreading a $state proxy produces a
    // fresh object on every evaluation. So a shallow copy is returned, and a
    // Python spread renders exactly like its JavaScript counterpart.
    spread(value) {
        if (value === null || value === undefined || typeof value !== 'object') return value;
        return { ...value };
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

// Methods that hand out a container the caller can then mutate, without any
// indexing to catch it.
const VIEWS = new Set(['items', 'values']);

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

        // The marker is checked first on purpose: this runs on every method
        // call in the program, and an unwatched object must pay one property
        // miss, not a set lookup.
        if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined) {
            if (MUTATORS.has(attr)) {
                if (attr === 'setdefault') inherit(obj, result);
                obj.$notify();
            } else if (VIEWS.has(attr)) {
                // `.items()` and `.values()` hand out the children without ever
                // indexing them. A Brython dict exposes its keys as enumerable
                // JavaScript properties, so the values are reachable directly —
                // no need to materialise the view to hand them the watch.
                for (const key in obj) inherit(obj, obj[key]);
            } else if (attr === 'get') {
                inherit(obj, result);
            }
        }

        return result;
    };

    const setitem = $B.$setitem;
    $B.$setitem = function (obj, key, value, ...rest) {
        const result = setitem(obj, key, value, ...rest);
        if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined) {
            inherit(obj, value); // `d["rows"] = rows` puts rows under watch too
            obj.$notify();
        }
        return result;
    };

    // Reading is where nesting is caught, and it is the hottest of the three:
    // an unwatched container pays one property miss and nothing else.
    const getitem = $B.$getitem;
    $B.$getitem = function (obj, ...rest) {
        const result = getitem(obj, ...rest);
        if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined) {
            inherit(obj, result);
        }
        return result;
    };

    const delitem = $B.$delitem;
    $B.$delitem = function (obj, ...rest) {
        const result = delitem(obj, ...rest);
        notify(obj);
        return result;
    };

    // `box.value = 1` and `del box.value`. Brython compiles an attribute write
    // through one of two entry points depending on the statement, and both have
    // to be covered or the rule would hold only half the time.
    for (const name of ['$setattr', '$setattr1']) {
        const setattr = $B[name];
        $B[name] = function (obj, attr, value, ...rest) {
            const result = setattr(obj, attr, value, ...rest);
            if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined) {
                inherit(obj, value); // an attribute holding a container is watched too
                obj.$notify();
            }
            return result;
        };
    }

    const delattr = $B.$delattr;
    $B.$delattr = function (obj, ...rest) {
        const result = delattr(obj, ...rest);
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
    if (value === NONE) return false; // a singleton shared by the whole program

    try {
        const cls = globalThis.__BRYTHON__.get_class(value);
        // A class object is not data — and a function is not an object here.
        return cls !== undefined && cls !== _b_.type;
    } catch {
        return false; // a foreign JavaScript value is not ours to mark
    }
}

// Attach a marker to the value stored under a module-level name: `bump` says it
// moved, `read` subscribes whoever is asking to the signal that says so. One
// object may be bound to two names; both are then told, and both watched.
//
// The pair is what makes the reactivity a property of the *object* rather than
// of the place it was declared — duck typing, applied to change notification.
// Anything holding the value can subscribe to it just by handing it through.
// Brython keeps an instance's attributes under a private symbol, not as JS
// properties — so they have to be found once, from the first object carrying it.
let DICT;

function ownAttributes(value) {
    if (Array.isArray(value)) return undefined;

    if (DICT === undefined) {
        DICT = Object.getOwnPropertySymbols(value).find((symbol) => symbol.description === 'DICT');
        if (DICT === undefined) return undefined;
    }

    return value[DICT];
}

function mark(value, bumps, reads) {
    const marker = () => {
        for (const one of bumps) one();
    };
    marker.bumps = bumps;
    marker.reads = reads;
    marker.follow = () => {
        for (const one of reads) one();
    };

    try {
        Object.defineProperty(value, '$notify', {
            value: marker,
            enumerable: false,
            configurable: true
        });
    } catch {
        /* a frozen object is not ours: leave it alone */
        return value;
    }

    // A container already sitting in an attribute — `self.rows = []` written in
    // __init__ — was put there before the object came under watch. Hand it the
    // watch now. inherit() marks in turn, so depth follows on its own, and a
    // cycle stops at the first object that already carries a marker.
    const attributes = ownAttributes(value);
    if (attributes !== undefined) {
        for (const key in attributes) inherit(value, attributes[key]);
    }

    return value;
}

export function track(value, bump, read) {
    if (value === null || typeof value !== 'object') return value;

    // Cheapest path first: a value already watched is the common case, and it
    // must not pay a type classification on every write.
    const own = value.$notify;
    if (own !== undefined) {
        if (!own.bumps.includes(bump)) {
            own.bumps.push(bump);
            own.reads.push(read);
        }
        return value;
    }

    return mutable(value) ? mark(value, [bump], [read]) : value;
}

// A container read out of a watched one comes under the same watch. This is
// what deep proxying buys Svelte, done lazily and without a single proxy: the
// child is marked the first time Python reaches for it, which is necessarily
// just before it could be mutated.
function inherit(parent, child) {
    if (child === null || typeof child !== 'object') return child;

    const marker = parent.$notify;
    const own = child.$notify;

    if (own !== undefined) {
        // Already watched — by another name, or by another parent. Both watches
        // stand; a mutation tells everyone who is looking.
        for (let i = 0; i < marker.bumps.length; i++) {
            if (!own.bumps.includes(marker.bumps[i])) {
                own.bumps.push(marker.bumps[i]);
                own.reads.push(marker.reads[i]);
            }
        }
        return child;
    }

    return mutable(child) ? mark(child, marker.bumps.slice(), marker.reads.slice()) : child;
}

// Subscribe the caller to the value it is being handed.
//
// Every other accessor reads the revision of its own name, which is enough. A
// `@derived` is not: Svelte memoises it on `===`, so a derived that returns the
// very object it was given propagates nothing when that object is mutated in
// place — the computation re-runs, the value compares equal, and the chain stops
// there. Reading the marker re-establishes it at the far end, where the reader
// is, rather than trying to defeat the memoisation.
export function follow(value) {
    if (value !== null && typeof value === 'object') {
        const marker = value.$notify;
        if (marker !== undefined) marker.follow();
    }

    return value;
}

// A Brython exception reaching JavaScript carries no `message` and no `stack`,
// so devtools and Vite's overlay show nothing at all — the text sits in the
// Python object, where nothing JS looks. Fill both in, keeping the original
// object so Python semantics upstream are untouched.
export function pyError(error, where, lineOffset = 0) {
    const $B = globalThis.__BRYTHON__;

    // One of ours, thrown by a template helper rather than by Python. It carries
    // its own sentence and the project's prefix; what it cannot know from inside
    // `date()` is which expression called it, and that is exactly what `where`
    // holds. Marked rather than sniffed, so a genuine JavaScript error keeps
    // crossing untouched.
    if (false) {
        error.$located = true;
        error.message = `${error.message} (${where})`;
    }

    if (!error || typeof error !== 'object' || error.message !== undefined) return error;

    // Not ours to describe: a JavaScript value thrown through a Python frame —
    // SvelteKit's own `error()` and `redirect()` do exactly that — must come out
    // the other side untouched, or the framework will not recognise it.
    try {
        if (globalThis.__BRYTHON__.get_class(error) === undefined) return error;
    } catch {
        return error;
    }

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
        /* no usable traceback */
    }

    const at = line === undefined ? where : `${where}:${line + lineOffset}`;

    try {
        error.message = `${described} (${at})`;
        if (error.stack === undefined) error.stack = `${error.message}\n    at ${at}`;
    } catch {
        /* a frozen exception: pass it on as it stands */
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

    // What the caller gets back is a promise, so an `async def` can be awaited
    // by whoever called it — `{#await greet()}` in a template above all, which
    // received `undefined` for as long as this returned nothing.
    //
    // run(coro, onsuccess, onerror). Its default onerror only logs, so an
    // exception raised inside a coroutine reaches nothing at all — no error
    // event, no overlay.
    let watched = false;

    const promise = new Promise((resolve, reject) => {
        $B.$getattr(aio, 'run')(
            result,
            (value) => {
                $B.leave_frame(); // what Brython's own default does
                resolve(value);
            },
            (error) => {
                const failure = pyError(error, where, lineOffset);
                reject(failure);

                // An event handler's return value is dropped on the floor, so
                // nobody is there to catch this one. Rethrowing from a timeout
                // turns it into a genuine uncaught error, the way the
                // synchronous path already behaves — but only when the caller
                // really did ignore the promise, or a template that awaits and
                // renders `{:catch}` would report the failure twice.
                setTimeout(() => {
                    if (!watched) throw failure;
                });
            }
        );
    });

    const settle = promise.then.bind(promise);

    // Handled here so the browser does not *also* report an unhandled
    // rejection: reporting is this function's job, and it does it above.
    settle(undefined, () => {});

    promise.then = (...handlers) => {
        watched = true;
        return settle(...handlers);
    };

    return promise;
}

// What an exported function hands back to the framework.
//
// SvelteKit serialises whatever `load()` returns, and a Brython dict carries
// symbol-keyed internals (`Symbol(OB_TYPE)`) that its serialiser refuses
// outright. So the boundary converts: Python containers become plain JavaScript
// data, which is the only shape anything outside Python can read anyway.
export function plainData(value, seen) {
    if (value === undefined || value === null || value === NONE) return null;
    if (typeof value !== 'object') return value;

    // A Brython float is an object holding a number and a reference to its
    // type. `tojson(1 / 3)` walks the lot: 20 KB of `ob_type`.
    if (value.ob_type === _b_.float) return value.value;

    // A coroutine handed to the framework becomes a promise. That is what lets a
    // `load()` stream: `{"lentes": chercher_lentement()}` returns a coroutine,
    // and SvelteKit waits on the promise it turns into.
    if (globalThis.__BRYTHON__.get_class(value) === globalThis.__BRYTHON__.coroutine) {
        // What it resolves to is Python too, and has to make the same crossing.
        return scheduleAsync(value, 'coroutine').then(plainData);
    }

    // A graph that loops back on itself would otherwise recurse until the stack
    // gives out, and the message names neither the file nor the value. What is
    // tracked is the *branch being walked*, not everything already converted:
    // the same object twice in one list is shared, not circular, and has to come
    // out twice. Note that `map` passes an index as its second argument, so every
    // recursive call below is written out rather than passing this function by
    // reference.
    seen ??= new Set();
    if (seen.has(value)) return null;
    seen.add(value);

    try {
        return branch(value, seen);
    } finally {
        seen.delete(value);
    }
}

function branch(value, seen) {
    if (Array.isArray(value)) return value.map((one) => plainData(one, seen)); // list, tuple

    // Anything with a constructor of its own is not ours to flatten: a Response,
    // a URL, a Date, a Map, a Promise — a Python `load()` may hand any of those
    // straight back to the framework, and copying their keys would destroy them.
    if (value.constructor !== undefined && value.constructor !== Object) return value;

    // A class instance keeps its attributes under a private symbol rather than as
    // JavaScript properties, so walking its own keys finds almost nothing and
    // wanders into the class object instead. Its `__dict__` is what a reader
    // wants, and it is what JavaScript itself would serialise from a class
    // instance: the fields, not the getters on the prototype.
    const attributes = ownAttributes(value);

    if (attributes !== undefined && attributes !== null && typeof attributes === 'object') {
        const fields = {};
        for (const key of Object.keys(attributes)) fields[key] = plainData(attributes[key], seen);
        return fields;
    }

    // Own string keys only, and never a class lookup: `get_class` probes the
    // object's symbols, and SvelteKit wraps `event.params` in a proxy that
    // records every key read — including the symbols we would have introduced,
    // which its serialiser then refuses. A Brython dict exposes its keys as
    // ordinary properties, so this reads both sides of the bridge.
    //
    // A set has no key to copy: `list(mon_set)` is the Python way to hand one
    // over, and it is what any serialiser would want anyway.
    const out = {};
    for (const key of Object.keys(value)) out[key] = plainData(value[key], seen);
    return out;
}

// What the framework hands *in* to an exported function.
//
// SvelteKit's request event carries `params` and `url` wrapped in proxies that
// record every key read, so it knows what a `load()` depended on. Brython probes
// an object's symbols when it wraps it for Python, those symbols land in the
// recorded set, and SvelteKit's serialiser then refuses them. Python must
// therefore never touch the proxy: the boundary reads it here, in JavaScript,
// and hands over a snapshot Python can rummage through freely.
//
// Duck-typed, and the identity for anything else — a module called from
// ordinary JavaScript keeps its arguments untouched.
function pyDict(entries) {
    const $B = globalThis.__BRYTHON__;
    const out = _b_.dict.$factory();

    for (const [key, value] of entries) $B.$setitem(out, key, value);
    return out;
}

// The inbound twin of `plainData`: a JavaScript value as real Python. The walk
// is Brython's own `JSObj.to_dict()`; what is left here is the root, which a
// method on an object cannot speak for — a scalar, a null, a bare array.
//
// What it buys, on a value that only ever crossed from JavaScript: `.get()`,
// `.items()` and `isinstance(x, dict)`. Without it, `.get` and `.keys` raise
// AttributeError while `.items` silently returns the *value* of a key spelled
// "items" — a failure whose shape depends on the data.
export function pyData(value) {
    const $B = globalThis.__BRYTHON__;

    if (value === undefined || value === null) return NONE;
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return _b_.list.$factory(value.map(pyData));

    const python = $B.jsobj2pyobj(value);

    // Idempotent, which it has to be: `jsobj2pyobj` hands back the *original*
    // Python object when the value once came from one — that is what the
    // `PYOBJ` WeakMap is for — and a dict has no `to_dict`. Asking for it
    // unconditionally made `to_py` raise on every value that did not need
    // converting, so it was no use as the guard on a boundary, which is the one
    // place anyone would reach for it.
    const toDict = $B.$getattr(python, 'to_dict', null);

    return toDict === null ? python : toDict();
}

export function pyArg(value) {
    if (value === null || typeof value !== 'object') return value;
    if (!value.params || !value.url || !value.request) return value;

    // Reading the framework's own searchParams is what registers the dependency,
    // so it is tried first — but it throws while prerendering, where a query
    // string cannot exist. Parsing the URL again is the fallback, and it touches
    // nothing SvelteKit guards.
    let query;
    try {
        query = [...value.url.searchParams];
    } catch {
        try {
            query = [...new URL(String(value.url)).searchParams];
        } catch {
            query = [];
        }
    }

    // Real dicts, not JavaScript objects: Python reaches for `.get()` and
    // `.items()`, and a JSObj has neither.
    return pyDict([
        ['params', pyDict(Object.entries({ ...value.params }))],
        ['query', pyDict(query)],
        ['url', String(value.url)],
        ['method', value.request.method],
        ['route', value.route && value.route.id],
        // The event itself, for whatever the snapshot does not cover — cookies,
        // fetch, setHeaders. It is a JavaScript object and stays one.
        ['js', value]
    ]);
}

// The same, for a module whose caller can wait: a framework awaits `load()`,
// so a coroutine has to come back as a promise rather than be fired and
// forgotten. Inside a component nobody awaits a handler, which is why the two
// are separate.
export function scheduleAsync(result, where, lineOffset = 0) {
    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (!aio || result === undefined || result === null) return result;
    if ($B.get_class(result) !== $B.coroutine) return result;

    return new Promise((resolve, reject) => {
        $B.$getattr(aio, 'run')(
            result,
            (value) => {
                $B.leave_frame();
                resolve(value);
            },
            (error) => reject(pyError(error, where, lineOffset))
        );
    });
}

// One Python function, made callable from JavaScript: arguments converted on the
// way in, coroutines awaited, containers converted on the way out.
//
// The arity matters. JavaScript calls with whatever it has — SvelteKit hands a
// query handler the validated payload whether or not the handler wants one —
// where Python raises on a positional argument it never declared. So the call is
// trimmed to the signature, which is what `def load():` beside `def load(event):`
// has always been allowed to mean.
// What a function the *framework* calls hands back — a transition, an action.
// Svelte does arithmetic on it: `Element.animate` refuses a duration that is not
// a number, and a Brython float is an object holding one.
//
// Only floats are unwrapped, one level down. Converting the whole value with
// `plainData` would be wrong: the same function can be called from Python, where
// a dict must stay a dict and a list must print as a list.
export function pyNumbers(value) {
    if (value === null || typeof value !== 'object') return value;
    if (value.ob_type === _b_.float) return value.value;

    for (const key of Object.keys(value)) {
        const one = value[key];

        if (one !== null && typeof one === 'object' && one.ob_type === _b_.float) {
            value[key] = one.value;
        } else if (typeof one === 'function') {
            // A callback the framework keeps and calls itself — a transition's
            // `tick(t, u)`. It never crosses a wrapper, so its arguments arrive
            // as raw JavaScript numbers, and Brython reads a number as an int.
            // So `tick(0, 1)` works — 0 and 1 *are* integers — and the first
            // frame after it raises `0.0026 can't be converted to BigInt`,
            // which is what a transition that plays once and then stops is.
            value[key] = (...args) => one(...args.map(inbound));
        }
    }

    return value;
}

export function pyCall(fn, where, lineOffset = 0, arity = Infinity) {
    return (...args) => {
        try {
            const given = args.slice(0, arity).map(pyArg);
            const result = scheduleAsync(fn(...given), where, lineOffset);

            return result instanceof Promise ? result.then(plainData) : plainData(result);
        } catch (error) {
            throw pyError(error, where, lineOffset);
        }
    };
}

// A Python function seen from JavaScript, wrapped by reading its own signature
// rather than a declaration we made — the layout is Brython's `$function_infos`:
// [2] the qualified name, [3] the file, [8] the `*args` name if there is one,
// [10] how many positional parameters were declared.
//
// Anything that is not a Python function comes back untouched.
// The same wrapping, for a DOM handler rather than an exported function.
//
// The difference is what happens to a coroutine. An exported function is
// awaited by whoever called it, so `scheduleAsync` hands back a promise. A DOM
// handler's return value is dropped on the floor, so it goes through `schedule`
// — which runs the coroutine, and reports a failure nobody observed by throwing
// it rather than leaving a rejected promise nobody will ever look at.
// What Python really handed over, and what it declares.
//
// A function read off *another* module — `helpers.click` as a handler — does not
// arrive as the accessor's own wrapper. `$B.imported` holds a plain JavaScript
// object, so Brython's interop wraps the function again, and that wrapper
// carries a `$function_infos` of its own with nothing in it but a name. It
// passes an `Array.isArray` guard and then trims to `undefined`, which trims
// nothing: `onclick={helpers.click}` called `click(event)` on a `def click()`.
//
// The original is kept on `$js_func`, and it is the one that answers for the
// signature — which is why `pyBoundary` carries `$function_infos` too.
function declared(value) {
    if (typeof value !== 'function') return null;

    const fn = typeof value.$js_func === 'function' ? value.$js_func : value;
    const infos = fn.$function_infos;

    // `arity` is what the whole thing is for, so a shape that has no number
    // there is not a Python signature, whatever else it carries.
    if (!Array.isArray(infos) || (!infos[8] && typeof infos[10] !== 'number')) return null;

    return { fn, where: `${infos[2]}() — ${infos[3]}`, arity: infos[8] ? Infinity : infos[10] };
}

// A Python function seen from JavaScript, wrapped by reading its own signature
// rather than a declaration we made: the same wrapping `pyExport` does, for a
// DOM handler rather than an exported function.
//
// The difference is what happens to a coroutine. An exported function is awaited
// by whoever called it, so `scheduleAsync` hands back a promise. A DOM handler's
// return value is dropped on the floor, so it goes through `schedule`, which
// runs the coroutine and reports a failure nobody observed by throwing it rather
// than leaving a rejected promise nobody will ever look at.
export function pyEvent(value, lineOffset = 0) {
    const found = declared(value);

    // Not a Python function, so there is nothing to wrap, and the value is on
    // its way to a DOM boundary like any other: `bound` is what turns None into
    // undefined there. Returning it untouched leaked the None object into every
    // attribute the handler test claims, and it claims more than handlers:
    // `on` followed by a lowercase letter also catches `once`, `only` and
    // `onboarding`, which Svelte 5 makes defensible for a component prop and
    // which was the one place `__bound` did not reach.
    if (found === null) return value;

    const { fn: called, where, arity } = found;

    // The offset is the number of lines before `<script lang="python">`, known
    // only to the generated script — without it an error in a handler names a
    // line counted from the tag rather than from the top of the file.
    return (...args) => {
        try {
            return schedule(called(...args.slice(0, arity).map(pyArg)), where, lineOffset);
        } catch (error) {
            throw pyError(error, where, lineOffset);
        }
    };
}

export function pyHandler(value) {
    const found = declared(value);
    if (found === null) return value;

    return pyCall(found.fn, found.where, 0, found.arity);
}

// A JavaScript function a Python module reached for — named in `__js__`, or
// imported by the component's own `<script module>`. Python calls it with Python
// values, and the one JavaScript genuinely cannot use is a Python callable: it
// refuses arguments it never declared and answers in Python objects.
//
// So every callable argument crosses the boundary the way an exported function
// does. That is what makes `query(accepted)` in Python read exactly like
// `query(accepted)` in TypeScript — no wrapper for the author to remember.
// A proxy rather than a wrapper function, because the name has to stay the thing
// it was: its own properties, its prototype, `instanceof`, and construction with
// `new` all still reach the original. Only a call made through it is adapted.
//
// The two directions are the same crossing an exported function makes, in
// reverse: a callable becomes JavaScript-callable, and everything else becomes
// plain data — `fail(400, {"missing": True})` reaching JavaScript as an object
// it can serialise, not as a Brython dict full of symbols.
const outbound = (value) => (typeof value === 'function' ? pyHandler(value) : plainData(value));

// And what comes *back*. Only the outbound half existed, and the asymmetry was
// silent for as long as nobody looked at the answer: a value returned by an
// `importjs` function arrived as a raw JavaScript one, so `cubicOut(0.5)` could
// not be rounded, formatted, or even multiplied — `x * 2` raised
// JavascriptError. The same call written `js.Math.sqrt(2)` gives a Python float,
// because Brython's own JSObject machinery converts and this proxy did not.
//
// `jsobj2pyobj` is that machinery, and it is conservative in exactly the way
// this needs: a number becomes an int or a float, a string a Python string, a
// function a Python-callable one, a DOM node a DOMNode — and everything else,
// plain objects and Promises included, is returned untouched. So a result handed
// straight back to JavaScript crosses unchanged, and an awaited promise still
// awaits.
const inbound = (value) => globalThis.__BRYTHON__.jsobj2pyobj(value);

export function jsCall(value) {
    if (typeof value !== 'function') return value;

    return new Proxy(value, {
        apply: (target, self, args) => inbound(Reflect.apply(target, self, args.map(outbound)))
    });
}

// A value a module exports. A dict of functions — which is what SvelteKit's
// `actions` is — becomes an object of *wrapped* functions, so a form action gets
// the same boundary treatment as a `load()`. Anything else is plain data.
export function pyExport(value, where, lineOffset = 0) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return plainData(value);

    const keys = Object.keys(value);

    if (keys.length && keys.every((key) => typeof value[key] === 'function')) {
        const out = {};
        for (const key of keys) out[key] = pyCall(value[key], `${where}.${key}`, lineOffset);
        return out;
    }

    return plainData(value);
}

// A module's function, read from Python.
//
// `$B.imported[name]` holds our namespace, which is an ordinary JavaScript
// object — the accessors live on its prototype, where a module's own attribute
// lookup does not reach. So Brython falls back to reading it as a foreign
// object, wraps what it finds, and converts the arguments on the way in. A
// `dict` handed from one Python file to another arrived as a JavaScript object,
// with `.get` gone and only the subscript left.
//
// The conversion is undone rather than prevented: `pyobj2jsobj` records what it
// converted in the WeakMap our vendored Brython carries, so the original object
// is there to be handed back. Anything not in it — a real JavaScript value —
// passes through untouched, and so do arrays, which cross as themselves.
const boundaries = new WeakMap();

const restored = (value) => {
    if (value === null || typeof value !== 'object') return value;

    const original = globalThis.__BRYTHON__.$svelthonPyobj?.get(value);

    return original === undefined ? value : original;
};

export function pyBoundary(fn) {
    if (typeof fn !== 'function') return fn;

    // Memoised, because Python compares a function by identity: reading
    // `helpers.look` twice has to answer the same object.
    let wrapped = boundaries.get(fn);

    if (wrapped === undefined) {
        wrapped = (...args) => fn(...args.map(restored));

        // The wrapper stands in for the Python function, so it answers for it
        // too: `$function_infos` is where the name, the file and the declared
        // arity are read from, and losing them leaves every caller downstream
        // handing a Python signature more arguments than it takes.
        wrapped.$function_infos = fn.$function_infos;
        boundaries.set(fn, wrapped);
    }

    return wrapped;
}

// A Python module under a JavaScript name, for the one place that needs one:
// what a directive *names*. Svelte copies that text into a `() => …` of its own,
// so `in:fades.typewriter` compiles to `() => fades.typewriter` and looks for a
// JavaScript `fades` — which an `import fades` never made, since it binds in
// Python's namespace.
//
// Members are wrapped the way a component's own functions are, not the way the
// module's exports are: measured, the export path runs `plainData` over the
// result, and a transition's `tick(0.5, 0.5)` then raises `0.5 cannot be
// converted to a BigInt` on the first fractional frame. `pyNumbers` is what
// repairs exactly that, and it is what a `def` written in the component already
// goes through.
//
// Read lazily, so the module only has to exist by the time the directive runs,
// and memoised per function, so two reads of the same name answer the same
// object — Svelte keeps what a directive gave it.
const directives = new WeakMap();

export function pyModule(name) {
    return new Proxy(
        {},
        {
            get(_, key) {
                const namespace = globalThis.__BRYTHON__.imported[name];
                const member = namespace === undefined ? undefined : namespace[key];

                if (typeof member !== 'function') return member;

                let wrapped = directives.get(member);

                if (wrapped === undefined) {
                    // Trimmed to the arity Python declared, exactly as a
                    // handler is: Svelte calls a transition `fn(node, params,
                    // options)`, and `def typewriter(node, params)` refuses the
                    // third. A `def` written in the component is trimmed by its
                    // own wrapper, which is why it worked and this did not.
                    const infos = member.$function_infos;
                    const arity = Array.isArray(infos) ? (infos[8] ? Infinity : infos[10]) : Infinity;
                    const where = Array.isArray(infos) ? `${infos[2]}() — ${infos[3]}` : `${name}.${key}()`;

                    wrapped = (...args) => {
                        try {
                            return pyNumbers(member(...args.slice(0, arity)));
                        } catch (error) {
                            throw pyError(error, where);
                        }
                    };

                    directives.set(member, wrapped);
                }

                return wrapped;
            }
        }
    );
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

// `pep.title` inside the markup, on a dict.
//
// A template's expressions already differ from the same text in the script: a
// `{#if}` goes through `__truthy` so an empty list is false the Python way, an
// interpolation through `__text` so a list renders `['a', 'b']`, an iterable
// through `__seq`, a spread through `__spread`. The dot joins them — it finds an
// attribute, and failing that a key, which is what Jinja does with `foo.bar` and
// what anyone arriving from Django or Flask already expects.
//
// Attribute first, so a dict's real methods keep winning: `{d.items}` is the
// method, not a key called "items". And a name that is neither raises the
// AttributeError it always did — the fallback never turns a typo into silence,
// which is the one place Jinja is weaker, its `Undefined` rendering nothing.
//
// The swap is what keeps this free. Brython's generated code reads
// `$B.$getattr_pep657` off the object at every call, so replacing it for the
// length of one expression costs two property writes and leaves every attribute
// access in the rest of the program untouched. Same technique as
// `withNamespace` above.
const MISSING = Symbol('svelthon.missing');

export function inTemplate(run) {
    const $B = globalThis.__BRYTHON__;
    const original = $B.$getattr_pep657;
    const originalSet = $B.$setattr1;

    $B.$getattr_pep657 = (obj, attr, inum) => {
        // With a default, so a miss costs no exception — building one on every
        // field read of every dict would be the whole cost of this feature.
        const found = $B.$getattr(obj, attr, MISSING);
        if (found !== MISSING) return found;

        try {
            return $B.$getitem(obj, attr);
        } catch {
            /* no such key either: let the real lookup raise, with its position */
        }

        return original(obj, attr, inum);
    };

    // `bind:value={row.label}` writes where the same dot read from. Without
    // this the read finds the key and the write sets a JavaScript property on
    // the dict — no error, no effect, and the field snaps back on the next
    // render. Only where the read already succeeded: an *existing* key. What a
    // missing one should do is still open, so it keeps Python's own answer.
    $B.$setattr1 = (obj, attr, value, inum) => {
        if ($B.$getattr(obj, attr, MISSING) === MISSING) {
            try {
                $B.$getitem(obj, attr);
                return $B.$setitem(obj, attr, value);
            } catch {
                /* no such key: the real assignment decides */
            }
        }

        return originalSet(obj, attr, value, inum);
    };

    try {
        return run();
    } finally {
        $B.$getattr_pep657 = original;
        $B.$setattr1 = originalSet;
    }
}

// What `(obj.attr := value)` and `(obj[key] := value)` compile to, the two the
// walrus has that Python's own grammar refuses it.
//
// The dot carries the same rule `inTemplate` installs for a read: an existing
// key wins over an attribute, so the write lands where the read came from. The
// rule is repeated here rather than borrowed, because a handler fires on the
// click, long after the expression that built it has left `inTemplate` and put
// the original `$setattr1` back. Borrowing it set a JavaScript property on the
// dict instead: no error, no effect, and the field back to its old value on the
// next render.
//
// They return the value, as an assignment expression must, so that a group can
// hold several and `{count}` still reads afterwards.
export function writeAttr(target, name, value) {
    const $B = globalThis.__BRYTHON__;

    if ($B.$getattr(target, name, MISSING) === MISSING) {
        try {
            $B.$getitem(target, name);
            $B.$setitem(target, name, value);

            return value;
        } catch {
            /* no such key either: the real assignment decides, and may raise */
        }
    }

    $B.$setattr1(target, name, value);

    return value;
}

export function writeItem(target, key, value) {
    globalThis.__BRYTHON__.$setitem(target, key, value);

    return value;
}

// `bind:group`, which Svelte will not take a getter/setter pair for: it works
// out which inputs form one group from the *text* of the expression, and two
// anonymous functions have none. So the markup pass turns it into this action
// instead — a directive whose value *is* Python, like every other one.
//
// The group then needs no identity at all. Each input computes its own `checked`
// from the same target, so exactly one radio stays filled and rows of an
// `{#each}` keep their own answer, both of which Svelte's own machinery gets
// wrong here for want of a notification.
//
// What the element carries is read off the node — `type` and `value` — so the
// markup pass never has to look at the rest of the tag. The value is therefore
// the DOM's, which is text: `value={5}` binds "5", exactly as a plain HTML form
// would hand it over.
export function group(node, [current, write]) {
    const boxes = node.type === 'checkbox';

    const show = (value) => {
        node.checked = boxes
            ? Array.from(value ?? []).includes(node.value)
            : String(value) === node.value;
    };

    const changed = () => {
        if (!boxes) return write(node.value);

        // A checkbox group is a list, and it has to arrive as Python's: an array
        // built here reads as a JavascriptArray, which prints `[a, c]` where
        // Python prints `['a', 'c']` and refuses a slice.
        const kept = Array.from(node.$svelthonGroup ?? []).filter((one) => one !== node.value);

        write(__pybridge.list(node.checked ? [...kept, node.value] : kept));
    };

    node.$svelthonGroup = current;
    node.addEventListener('change', changed);
    show(current);

    return {
        update([next]) {
            node.$svelthonGroup = next;
            show(next);
        },
        destroy() {
            node.removeEventListener('change', changed);
        }
    };
}

// A shared clock, for the values that go stale on their own — `fromnow` is the
// one, and Django never needed it because a rendered page is finished. A
// component stays on screen, so "3 minutes ago" has to become "4 minutes ago"
// without anyone touching the page.
//
// One timer for the whole document, not one per date: every reader registers
// through the same subscriber, so a tick re-runs exactly the blocks that read a
// relative time and nothing else. `createSubscriber` is a no-op on the server,
// which is what stops a render from arming anything.
//
// The delay is what the *display* needs, not a fixed beat: a value shown in
// seconds asks to be woken in a second, one shown in days asks for a day. So it
// slows down on its own as the dates age, and the cap keeps a timer that would
// otherwise be set for months down to an hour — which never sleeps, and costs
// nothing.
const AT_MOST = 3600 * 1000;

let announce = null;
let armed = null;
let wanted = Infinity;

// `createSubscriber` hands `update` to a *render effect*, so it arrives on the
// next flush rather than on the line after the call. The delay asked for is
// therefore recorded first and armed whenever arming becomes possible — once
// here, once from `start`. Getting that backwards leaves the timer unset and the
// value frozen, with nothing to show for it.
const clock = createSubscriber((update) => {
    announce = update;
    arm();

    return () => {
        announce = null;
        if (armed) clearTimeout(armed.timer);
        armed = null;
        wanted = Infinity;
    };
});

function arm() {
    if (announce === null || wanted === Infinity) return;

    const at = Date.now() + wanted;

    // Keep the soonest of everything asked for since the last tick.
    if (armed && armed.at <= at) return;
    if (armed) clearTimeout(armed.timer);

    armed = {
        at,
        timer: setTimeout(() => {
            armed = null;
            wanted = Infinity;
            announce?.();
        }, wanted)
    };
}

export function ticking(after) {
    // Registers the dependency: the block calling this re-runs on the next tick.
    clock();

    if (!(after > 0)) return;

    wanted = Math.min(wanted, after, AT_MOST);
    arm();
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

