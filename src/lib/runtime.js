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

    // `{...attrs}` — Svelte diffs the spread object against the one from the
    // previous render, and a dict mutated in place *is* the same object. In
    // JavaScript the problem does not arise: spreading a $state proxy produces a
    // fresh object on every evaluation. So a shallow copy is returned, and a
    // Python spread renders exactly like its JavaScript counterpart.
    spread(value) {
        if (value === null || value === undefined || typeof value !== 'object') return value;
        return { ...value };
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
        /* pas de traceback exploitable */
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

// What an exported function hands back to the framework.
//
// SvelteKit serialises whatever `load()` returns, and a Brython dict carries
// symbol-keyed internals (`Symbol(OB_TYPE)`) that its serialiser refuses
// outright. So the boundary converts: Python containers become plain JavaScript
// data, which is the only shape anything outside Python can read anyway.
export function plainData(value, seen) {
    if (value === undefined || value === null || value === NONE) return null;
    if (typeof value !== 'object') return value;

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
export function pyHandler(value) {
    if (typeof value !== 'function' || !Array.isArray(value.$function_infos)) return value;

    const infos = value.$function_infos;

    return pyCall(value, `${infos[2]}() — ${infos[3]}`, 0, infos[8] ? Infinity : infos[10]);
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

export function jsCall(value) {
    if (typeof value !== 'function') return value;

    return new Proxy(value, {
        apply: (target, self, args) => Reflect.apply(target, self, args.map(outbound))
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
