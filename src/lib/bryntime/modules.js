// The Python modules a page runs, compiled ahead: each one's namespace and its
// accessors, its body run at the line that imports it and what a failed run
// leaves undone, `globals()`, `del` of a name, and the names it publishes to
// JavaScript, live. Moved out of the runtime as it was; the host reaches it
// through `bryntime.js`.
import * as core from './crossing.js';
import * as tracking from './tracking.js';
import * as calls from './calls.js';

// Held as constants of this module, as its neighbours hold theirs: a binding
// imported is read through the module's cell at each use, and a namespace's
// accessors are the hottest path of a name.
const { host, mutableBytes, pyBytes } = core;
const { NAMESPACE_DICTS, STORED, heldAtSource, track } = tracking;
const { STALE, flushExports } = calls;

// The body of a derived, an effect or an `inspect`, called the way Python calls
// it: a decorator may have made it a callable instance or a bound method, which
// are Brython objects and not JavaScript functions. A function is called as it
// is, which is the path every undecorated body takes.
export const invoke = (fn) => {
    // Exports flushed after it, as at every door Python hands control back
    // through: a `bytearray` an effect changed is new to the effect after it.
    try {
        return typeof fn === 'function' ? fn() : globalThis.__BRYTHON__.$call(fn);
    } finally {
        flushExports();
    }
};
let staleQueued = false;

const markStale = (refresh) => {
    STALE.add(refresh);

    if (staleQueued) return;

    staleQueued = true;
    queueMicrotask(() => {
        staleQueued = false;
        flushExports();
    });
};

// A value a plain module exports is a live binding, as a JavaScript module's
// `export let` is: `update` is the module's own assignment to its exported
// name, made now and again on every write Python makes to the name, through the
// module's functions or from another module.
//
// On the namespace's prototype, where `bind` puts the accessor of every
// reactive name: the engine deletes the namespace's own property of a name
// before it assigns it again in a function (`delete_for_reassign`), and a hook
// placed there went with it. A reactive name's accessor is wrapped where it is;
// a class, which has none, is moved there beside them.
export function liveExport(namespace, name, update) {
    const prototype = Object.getPrototypeOf(namespace);
    let holder = namespace;
    let found;

    while (holder !== null && (found = Object.getOwnPropertyDescriptor(holder, name)) === undefined) {
        holder = Object.getPrototypeOf(holder);
    }

    let stored = found?.value;
    const read = found?.get ? () => found.get.call(namespace) : () => stored;
    const write = found?.set ? (next) => found.set.call(namespace, next) : (next) => (stored = next);

    if (holder === namespace) delete namespace[name];

    // A `bytearray` crosses as the bytes it holds when it crosses (`bytesOut`),
    // so a change Python makes to it is taken again as a write of the name is:
    // the export is watched while it holds one, and let go when it is rebound.
    // Taken again once, when JavaScript next has the hand (`flushExports`), and
    // not at each change: a copy per `append` made filling one byte by byte
    // quadratic, where JavaScript reads only the last.
    const refresh = () => update(read());
    const stale = () => markStale(refresh);
    const watch = (value) => {
        if (stale.held !== undefined || (pyBytes(value) && mutableBytes(value))) track(value, stale);
    };

    Object.defineProperty(prototype, name, {
        configurable: true,
        enumerable: found?.enumerable ?? true,
        get: read,
        set(next) {
            write(next);
            watch(read());
            update(read());
        }
    });

    watch(read());
    update(read());
}

// A store's namespace, published under its Python module name, so a component's
// own Python can `import counter_store` and reach the very same signals the
// template reads. Without it the bridge would only run one way.
//
// Two files of one Python name are refused by the plugin, which sees the disk
// and tells a second file from a rename (`claimPython`). Here the last file
// evaluated holds the name, which is the renamed one under the dev server.
export function registerModule(name, namespace) {
    namespace.__name__ = name;
    globalThis.__BRYTHON__.imported[name] = namespace;
}

// The bodies of the modules Python imports by name, which run at the import
// statement and not when their code is evaluated. A component or a module
// that imports `optional` under an `if` not taken, in a function never called
// or in a `try` has its code at hand, evaluated in front of its own, and the
// body of `optional` runs when, and if, the statement does: in its order among
// the importer's effects, and with its exception raised there, where an
// `except` can take it.
const WAITING = new Map();

// `import x`, `from x import y` and `__import__("x")` all reach the engine's
// `$__import__`, which looks the name up in `$B.imported`: a body still
// waiting runs first, so the lookup finds its namespace.
//
// Untracked, as the module's own: an import in a `@derived` or in a function
// the template calls runs the body under that reaction, and a reactive
// module's first bindings were writes Svelte refused there
// (`state_unsafe_mutation`). What the importer reads of the module afterwards
// is read where it is, and followed.
const importsRunBodies = ($B) => {
    if ($B.$bryntimeImports) return;
    $B.$bryntimeImports = true;

    const engine = $B.$__import__;

    $B.$__import__ = function (name, ...rest) {
        const waiting = WAITING.get(name);

        if (waiting !== undefined) host.untrack(waiting);
        return Reflect.apply(engine, this, [name, ...rest]);
    };
};

// The module's body, `run`, behind the function that runs it once: an import
// statement calls it through the engine, and the module JavaScript imports
// calls it as it is evaluated (`svelthon.js`, `eagerModule`). `published`
// is the name it is imported by, or null for a name no `import` can write,
// `+page.server`.
//
// The namespace is published before the body runs, so an import cycle finds
// the module half made rather than running it twice. A body that raises is
// taken back out, and the next import runs it again in a new namespace, which
// `renew` hands to the generated code (`moduleLoad`).
export function pythonModule(first, published, renew, run) {
    const $B = globalThis.__BRYTHON__;
    let state = 'waiting';
    let namespace = typedModule($B, first);

    importsRunBodies($B);

    const load = () => {
        if (state !== 'waiting') return;

        state = 'running';
        if (published !== null) registerModule(published, namespace);

        const before = new Set(Object.keys(namespace[$B.DICT]));

        try {
            run();
            state = 'done';
        } catch (error) {
            state = 'waiting';
            if (published !== null && $B.imported[published] === namespace) delete $B.imported[published];

            namespace = abandoned($B, namespace, before);
            renew(namespace);

            throw error;
        }

        if (WAITING.get(published) === load) WAITING.delete(published);
    };

    if (published !== null) WAITING.set(published, load);

    return load;
}

// A module to Python, and not a JavaScript object: `module.name`, `from module
// import name`, `getattr` and `hasattr` read the names through its dict, which
// holds the names the namespace holds now. A name the module has not bound
// yet, in an import cycle, or has deleted, is missing there, where its accessor
// read `None`. Under the engine's own symbol, which it reads before the field:
// `ob_type` may be a name of the module's.
function typedModule($B, namespace) {
    Object.defineProperty(namespace, $B.OB_TYPE, { value: $B.module });
    namespace[$B.DICT] = namespaceDict(namespace);
    return namespace;
}

// The namespace of an attempt that raised, left as it was to whoever holds it,
// the module itself or an import cycle, and sharing nothing with the next one.
// It leaves the accessors it shared, so a name the next attempt binds is not
// one of its own, and a name written on it is written on it alone; it keeps
// what is not a name of the module, the helpers the compiler lends it, which
// read no cell. Each name it holds is kept as it reads, and nothing is
// computed: a value as its own, and a derived as its definition, computed
// again in it when read, as it was. And the new namespace the next attempt
// runs in, on the shared accessors, where what the failed one bound is deleted
// as `del` deletes it.
function abandoned($B, namespace, before) {
    const held = Object.keys(namespace[$B.DICT]);
    const shared = Object.getPrototypeOf(namespace);
    const computed = COMPUTED.get(shared);
    const kept = Object.create(Object.getPrototypeOf(shared));
    const sources = new Map();

    for (const key of Reflect.ownKeys(shared)) {
        const descriptor = Object.getOwnPropertyDescriptor(shared, key);

        if (!descriptor.enumerable || !moduleName(key)) Object.defineProperty(kept, key, descriptor);
    }

    for (const name of held) {
        if (Object.hasOwn(namespace, name)) continue;

        if (computed?.has(name)) {
            const value = heldAtSource(namespace, name);

            sources.set(name, () => value);
            Object.defineProperty(kept, name, {
                get: () => invoke(value),
                set(next) {
                    Object.defineProperty(this, name, { value: next, writable: true, enumerable: true, configurable: true });
                },
                enumerable: true,
                configurable: true
            });
        } else {
            // What the name reads as, which only a derived computes: a root's
            // name reads as its destructor, held at its source as the `def`.
            const value = namespace[name];

            Object.defineProperty(namespace, name, { value, writable: true, enumerable: true, configurable: true });
        }
    }

    STORED.set(kept, sources);
    Object.setPrototypeOf(namespace, kept);

    const next = Object.create(shared);

    next.$proxy = true;
    next.__name__ = namespace.__name__;
    typedModule($B, next);

    for (const name of held) if (!before.has(name) && holdsName(next, name)) $B.$delete(name, next);

    return next;
}

// Hand Brython our namespace instead of the one it would have made for itself.
//
// The codegen opens every module body with `locals_X = $B.namespace('X')`, so
// intercepting that single call is enough, with no rewriting of generated code.
// The name is checked because a module body may import others while it runs,
// and each import creates its own namespace through the same function.
export function withNamespace(name, namespace, run) {
    const $B = globalThis.__BRYTHON__;
    const original = $B.namespace;
    const importFrom = $B.$import_from;

    $B.namespace = (requested) => (requested === name ? namespace : original(requested));

    // The module's `__dict__`, which the engine reads a module's names from.
    namespace[$B.DICT] = namespaceDict(namespace);

    // `from m import *` binds names the compiler could not list, written onto the
    // namespace as plain properties: in a reactive module they are given their
    // accessors as the import binds them. A plain `.py` holds no signals.
    $B.$import_from = function (module, names, aliases, level, locals) {
        if (locals !== namespace || namespace.$bryntimeStarred === undefined || !Array.isArray(names) || !names.includes('*')) {
            return importFrom.apply(this, arguments);
        }

        const before = new Set(Object.keys(namespace));

        try {
            return importFrom.apply(this, arguments);
        } finally {
            for (const one of Object.keys(namespace)) if (!before.has(one) && !one.startsWith('$')) starred(namespace, one);
        }
    };

    try {
        return run();
    } finally {
        $B.namespace = original;
        $B.$import_from = importFrom;
    }
}

// A name `from m import *` bound, given the accessor every name of the module
// gets, on the prototype as `bind` places them, with a revision made here since
// none was declared for it: a list imported this way and appended to repaints
// what reads it, as one imported by name does. Unsubscribed with the
// component's own list, which the compiler hands over on the prototype. A store
// keeps them under `names` too, which it publishes when it has no `__all__`,
// since it then publishes every name it has.
function starred(namespace, name) {
    const proto = Object.getPrototypeOf(namespace);

    // Only the generated namespace's own prototype is ours to write on.
    if (proto === null || proto === Object.prototype) return;

    const { owner, names } = namespace.$bryntimeStarred;

    names?.add(name);
    let update;
    const changed = host.subscriber((one) => {
        update = one;

        return () => {
            update = undefined;
        };
    });
    const bump = () => update?.();
    let held = track(namespace[name], bump, owner);

    delete namespace[name];

    bind(
        proto,
        name,
        () => (changed(), held),
        (value) => {
            held = track(value, bump, owner);
            bump();
        },
        () => held
    );
}

// A module namespace object: no prototype, and the tag `Module` as a data
// property of its own, which a module's exports cannot replace.
export const moduleNamespace = (value) =>
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === null &&
    Object.getOwnPropertyDescriptor(value, Symbol.toStringTag)?.value === 'Module';

// The names whose reading computes what they hold, a derived's: what a failed
// module keeps of one is its definition, still computed when read.
const COMPUTED = new WeakMap();

const holdsName = (namespace, name) => heldAtSource(namespace, name) !== undefined;

// When each name of a namespace was bound, which is the order `globals()` lists
// them in, as a dict lists its keys: the accessors sit on the prototype in the
// order the compiler declared them, all values and then all functions. A name
// bound again keeps its place; a name deleted and bound again goes last.
//
// A name with no accessor, a class, is written as the namespace's own, which
// no setter sees; JavaScript keeps own keys in the order they were made. So
// before each new stamp, and before a listing, the own keys not stamped yet
// are stamped in that order: each was made since the last stamp, and before
// the one being made.
const BOUND_AT = new WeakMap();
let bindings = 0;

const stampsOf = (namespace) => {
    let stamps = BOUND_AT.get(namespace);

    if (stamps === undefined) BOUND_AT.set(namespace, (stamps = new Map()));
    for (const key of Object.keys(namespace)) if (!stamps.has(key)) stamps.set(key, ++bindings);

    return stamps;
};

const stampBound = (namespace, name) => {
    const stamps = BOUND_AT.get(namespace);

    if (stamps === undefined || !stamps.has(name)) {
        const current = stampsOf(namespace);
        if (!current.has(name)) current.set(name, ++bindings);
    }
};

const unstampBound = (namespace, name) => BOUND_AT.get(namespace)?.delete(name);

const inBindingOrder = (namespace, names) => {
    const stamps = stampsOf(namespace);

    return names.sort((one, other) => (stamps.get(one) ?? 0) - (stamps.get(other) ?? 0));
};

// Expose one component-level signal as a property of the namespace Brython
// writes into. Values pass through untouched, never wrapped, never proxied,
// which is the point: a Svelte state proxy around a Brython object breaks its
// type machinery (`repr((1, 2))` fails with "requires a 'tuple' object but
// received a 'tuple'"). Reactivity comes from rebinding the signal, not from
// observing the value.
//
// Accessors go on the *prototype*, never on the namespace itself. Rebinding a
// global emits `$B.delete_for_reassign(name, locals)` ahead of the assignment,
// and a plain `delete locals.count` would drop an own accessor for good,
// unhooking the signal after the very first write. `delete` ignores inherited
// properties; assignment still runs the inherited setter.
//
// `source` reads what the name holds as stored, with no conversion and no
// computation, where `get` does either: a prop's number made a float, a
// derived's body run. It is what `del` watches; without one, `get` is it
// (`STORED`).
//
// `listed` is false for a helper the compiler injects: a word of the framework,
// readable like a builtin, and no name of the module's own, so `globals()` does
// not list it.
export function bind(proto, key, get, set, source, listed = true, computed = false) {
    if (source !== undefined) {
        let sources = STORED.get(proto);
        if (sources === undefined) STORED.set(proto, (sources = new Map()));
        sources.set(key, source);
    }

    if (computed) {
        let names = COMPUTED.get(proto);
        if (names === undefined) COMPUTED.set(proto, (names = new Set()));
        names.add(key);
    }

    // No setter means the name is a *default*: an injected helper, or a
    // JavaScript name published for Python to read. The author may still take
    // that word: Brython writes a global as a plain property assignment on the
    // namespace, which would walk the prototype chain, find `() => {}` and go
    // nowhere, so `class date: …` would leave no class behind.
    //
    // Writing an own property on the receiver is what a prototype is for: the
    // default answers until someone assigns, and then theirs shadows it. Not an
    // arrow, because `this` has to be the namespace being written to.
    const write =
        set ??
        function (value) {
            Object.defineProperty(this, key, {
                value,
                writable: true,
                enumerable: true,
                configurable: true
            });
        };

    Object.defineProperty(proto, key, {
        get,
        set(value) {
            write.call(this, value);
            if (value !== undefined) stampBound(this, key);
        },
        enumerable: listed,
        configurable: true
    });
}

// `del name` on a name `bind` publishes. Brython's `del` deletes an own
// property, and the name is an accessor the namespace inherits.
//
// A real `del` is `$B.$delete`, not the `delete_for_reassign` that precedes a
// rebinding, so the two can be told apart. A deleted name has to be *absent*,
// the way it is in any namespace: a read raises `NameError` or goes on to the
// builtins, `len` found again once `len` is deleted, and `"count" in
// globals()` is false. And the page that read it has to stay subscribed, so
// that rebinding it, by `=`, a loop or an import, repaints.
(function installDeletion($B) {
    const deleteName = $B.$delete;
    const isMember = $B.$is_member;
    const DELETED = new WeakMap();

    $B.$delete = function (name, locals, inum) {
        const namespace = locals === 'global' ? $B.frame_obj?.frame?.[3] : locals;
        const proto = namespace !== null && typeof namespace === 'object' ? Object.getPrototypeOf(namespace) : null;
        const accessor =
            namespace?.$proxy === true && !Object.hasOwn(namespace, name)
                ? Object.getOwnPropertyDescriptor(proto, name)
                : undefined;

        // Bound again, it goes last (`BOUND_AT`).
        if (namespace !== null && typeof namespace === 'object') unstampBound(namespace, name);

        // Asked at its source, which runs no derived's body.
        if (accessor?.get === undefined || !holdsName(namespace, name)) {
            return deleteName.call(this, name, locals, inum);
        }

        accessor.set?.call(namespace, undefined);

        // What the name still holds once deleted, read at its source: nothing,
        // or the value a parent passes a prop, which the child does not own.
        const sources = STORED.get(proto);
        const stored = sources?.get(name);
        const source = stored ?? accessor.get;
        const left = source.call(namespace);
        const restore = (target) => {
            Object.defineProperty(proto, name, accessor);
            if (stored === undefined) sources?.delete(name);
            else sources.set(name, stored);
            DELETED.get(target)?.delete(name);
        };

        // Absent at its source too, until the source holds something else.
        if (sources !== undefined) {
            sources.set(name, function () {
                const now = source.call(this);
                return Object.is(now, left) ? undefined : now;
            });
        }

        // Absent to Python, still read by the page: the source is a signal,
        // which keeps the page subscribed, and the getter hands back
        // `undefined`, which a `$proxy` namespace reads as no name at all. Any
        // write puts the published accessor back: through the namespace, by
        // `=`, a loop, an import or a store's setter; or from outside it, a
        // parent passing a prop a new value, which the source shows. Listed as
        // the name was, so `globals()` asks the source, and finds that value
        // before anything reads the name.
        Object.defineProperty(proto, name, {
            get() {
                if (Object.is(source.call(this), left)) return undefined;

                restore(this);
                return accessor.get.call(this);
            },
            set(value) {
                restore(this);
                accessor.set?.call(this, value);
            },
            enumerable: accessor.enumerable,
            configurable: true
        });

        let deleted = DELETED.get(namespace);
        if (deleted === undefined) DELETED.set(namespace, (deleted = new Set()));
        deleted.add(name);
    };

    // `name in globals()`: the namespace is the globals, and a deleted name is
    // not in it, unless reading it finds a new value.
    $B.$is_member = function (item, container) {
        if (typeof item === 'string' && DELETED.get(container)?.has(item) && container[item] === undefined) {
            return false;
        }
        return isMember.call(this, item, container);
    };
})(globalThis.__BRYTHON__);

// **`globals()` is a dict**, as CPython has it, and the module's own: what is
// written to it is a global, what is deleted from it is gone. Our namespace is a
// JavaScript object whose names are accessors on its prototype, so Brython
// handed it over as a foreign object: `"count" in globals()` held and
// `globals().keys()`, `.copy()`, `.pop()`, `list(globals())` did not.
//
// So `globals()` answers a dict that is a view of the namespace: a Brython dict
// as its target, which is what gives it its class, and every key read, written
// and deleted on the namespace itself. A dict of string keys keeps them as its
// own properties, so the view reports the module's names as its own. The names
// are the author's: the compiler's own (`__truthy`, `__py`) and the helpers it
// injects (`tojson`, `effect`) are no more globals than `len` is, and a name
// deleted or not yet bound is not there. `locals()` at the top of a module is
// the same dict, as in CPython, and `dir()` reads it.
//
// One key shape is refused rather than half kept: a key that is not a string
// would move a Brython dict to its table, a copy that stops following the
// namespace.
//
// The same dict is the module's `__dict__` to the engine (`$B.DICT`, set by
// `withNamespace`), which is where `from m import *` reads a module with no
// `__all__`, and `from m import name` the name.
const COMPILER_NAME = /^__(?!.*__$)/;

// A key that may be a name of the module's: not the engine's `$` fields, and
// not a word of the compiler's.
const moduleName = (key) => typeof key === 'string' && !key.startsWith('$') && !COMPILER_NAME.test(key);
const DICTS = new WeakMap();

// How many keys a namespace's dict has added or removed, the version Brython
// keeps on a dict of its own.
const NAMESPACE_VERSIONS = new WeakMap();
const changedShape = (dict) => NAMESPACE_VERSIONS.set(dict, (NAMESPACE_VERSIONS.get(dict) ?? 0) + 1);

// Brython walks a dict as items, each with its value read, whether the keys
// alone are wanted, `list(globals())`, or the pairs, and in both directions,
// `reversed(globals())`. A namespace's value may be a derived, run by being
// read, so its items read their value only when it is asked for. A key added
// or removed meanwhile ends the walk, as it ends Brython's.
(function lazyNamespaceItems(dict) {
    const $B = globalThis.__BRYTHON__;
    const changed = () => $B.RAISE($B.builtins.RuntimeError, 'dictionary changed size during iteration');
    const iterReversed = dict.$iter_items_reversed;

    // The reverse walk's items are pairs, the value the second of them.
    dict.$iter_items_reversed = function* (d) {
        if (!NAMESPACE_DICTS.has(d)) {
            yield* iterReversed.call(this, d);
            return;
        }

        const version = NAMESPACE_VERSIONS.get(d);

        for (const key of Object.keys(d).reverse()) {
            const pair = Object.defineProperty([key], 1, { get: () => d[key], enumerable: true });

            yield $B.fast_tuple(pair);
            if (NAMESPACE_VERSIONS.get(d) !== version) changed();
        }
    };

    const iterItems = dict.$iter_items;

    dict.$iter_items = function* (d) {
        if (!NAMESPACE_DICTS.has(d)) {
            yield* iterItems.call(this, d);
            return;
        }

        const version = NAMESPACE_VERSIONS.get(d);

        for (const key of Object.keys(d)) {
            yield {
                key,
                get value() {
                    return d[key];
                }
            };

            if (NAMESPACE_VERSIONS.get(d) !== version) changed();
        }
    };
})(globalThis.__BRYTHON__.builtins.dict);

function namespaceDict(namespace) {
    const $B = globalThis.__BRYTHON__;
    const known = DICTS.get(namespace);

    if (known !== undefined) return known;

    // A name is there by what it holds at its source, so listing or counting
    // the names runs no derived; its value is read when it is asked for. The
    // prototype asked as it is now: a failed module's leaves the shared one.
    const named = (key) =>
        moduleName(key) &&
        (Object.hasOwn(namespace, key) ||
            Object.getOwnPropertyDescriptor(Object.getPrototypeOf(namespace), key)?.enumerable === true) &&
        holdsName(namespace, key);
    const names = () =>
        inBindingOrder(
            namespace,
            [...new Set([...Object.keys(namespace), ...Object.keys(Object.getPrototypeOf(namespace))])].filter(named)
        );

    const dict = new Proxy($B.empty_dict(), {
        get(target, key) {
            return named(key) ? namespace[key] : Reflect.get(target, key);
        },
        has(target, key) {
            return named(key) || Reflect.has(target, key);
        },
        ownKeys(target) {
            return [...names(), ...Reflect.ownKeys(target)];
        },
        getOwnPropertyDescriptor(target, key) {
            return named(key)
                ? {
                      get: () => namespace[key],
                      set: (value) => {
                          namespace[key] = value;
                      },
                      enumerable: true,
                      configurable: true
                  }
                : Reflect.getOwnPropertyDescriptor(target, key);
        },
        set(target, key, value) {
            if (typeof key === 'string') {
                const added = !named(key);

                namespace[key] = value;
                if (added) {
                    // A name the compiler did not declare is written as the
                    // namespace's own, past the accessors that stamp.
                    stampBound(namespace, key);
                    changedShape(dict);
                }

                return true;
            }

            if (!Object.hasOwn(target, key)) {
                throw $B.$call($B.builtins.TypeError, `${host.name} — a module's globals() takes names, which are strings`);
            }

            return Reflect.set(target, key, value);
        },
        deleteProperty(target, key) {
            if (named(key)) {
                $B.$delete(key, namespace);
                changedShape(dict);
            }

            return true;
        }
    });

    DICTS.set(namespace, dict);
    NAMESPACE_DICTS.set(dict, namespace);

    return dict;
}

(function installGlobals($B) {
    const ours = (namespace) => namespace !== null && typeof namespace === 'object' && namespace.$proxy === true;

    const wrap = (name, answer) => {
        const original = $B.builtins[name];
        const wrapped = function (...args) {
            return answer(original, this, args);
        };

        $B.builtins[name] = Object.assign(wrapped, original);
    };

    wrap('globals', (original, self, args) => {
        const found = original.apply(self, args);

        return ours(found) ? namespaceDict(found) : found;
    });

    wrap('locals', (original, self, args) => {
        const frame = $B.frame_obj?.frame;

        if (frame === undefined || !ours(frame[1]) || frame[1] !== frame[3]) return original.apply(self, args);

        // The engine's own refusal of an argument, which a module's namespace
        // would otherwise skip: `locals(1)` raises at every level alike.
        $B.check_nb_args_no_kw('locals', 0, args);

        return namespaceDict(frame[1]);
    });

    // **A namespace of ours outlives the frame that fills it.** Leaving a
    // frame that made a generator, the engine walks the frame's locals and
    // closes the context managers of the generators among them, as if they
    // died with it. A module's namespace lives on with its component or its
    // store: walking it read every name, a `@derived` computed included, so an
    // unused one ran, and raised, at mount; and the generators it still holds
    // are not the frame's to close, as a module's globals outlive its body in
    // CPython.
    const leave = $B.leave_frame;

    $B.leave_frame = function (...args) {
        const frame = $B.frame_obj?.frame;

        if (frame?.$has_generators && ours(frame[1])) frame.$has_generators = false;

        return leave.apply(this, args);
    };
})(globalThis.__BRYTHON__);
