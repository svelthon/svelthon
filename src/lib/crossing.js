// What crosses between Python and JavaScript, and how: the core of Bryntime,
// the runtime a page uses to read Python from JavaScript and JavaScript from
// Python, with or without Svelte. It imports nothing of Svelte; `runtime.js`
// imports it and hands Svelte what Svelte asks.
//
// First, what the engine marks as its own: the questions every door asks of a
// value before it decides what the value becomes.
import './globals.js';
import './boot.js';

// Python's None, so a prop the parent never passed reads as None rather than
// leaking JavaScript's undefined into Python.
export const NONE = globalThis.__BRYTHON__.builtins.None;

export const _b_ = globalThis.__BRYTHON__.builtins;

// A Python class, recognised by its shape the way the rest of this file
// recognises Brython's own objects: it carries `tp_name` and `tp_bases` beside
// its `ob_type`, which no instance and no dict does.
//
// The decision it serves is that **a class crosses as itself rather than
// flattened**: refusing an accurate `__all__` because JavaScript would need
// `$B.$call` to use one of its entries would be a JavaScript limit imposed on
// Python. A class exported directly and the same class inside a dict or a list
// cross alike, since a `load()` returning a registry of models is the ordinary
// way to write a route, so the decision lives in this predicate, which every
// path that meets a class asks.
export const pyClass = (value) =>
    value !== null &&
    typeof value === 'object' &&
    ownType(value) !== undefined &&
    value.tp_name !== undefined &&
    value.tp_bases !== undefined;

// The class of a Python object, or undefined for anything else. Brython keeps
// it in two places: `ob_type` on most objects, and `Symbol(OB_TYPE)` on a dict
// and every subclass of one, which has no `ob_type` at all. A site that looks a
// protocol up on the class asks here, so `class Bag(dict)` defining `__call__`
// is callable like any other class that defines it. Of an object only; a
// function is asked through `quietPyType`.
export const pyType = (value) => (value !== null && typeof value === 'object' ? quietPyType(value) : undefined);

// What an object holds under a name, read off the descriptors along its chain
// without running a getter: undefined for an accessor, which the serialiser
// alone reads, at its turn.
export const quietly = (value, name) => {
    for (let at = value; at !== null; at = Object.getPrototypeOf(at)) {
        const found = Object.getOwnPropertyDescriptor(at, name);

        if (found !== undefined) return 'value' in found ? found.value : undefined;
    }

    return undefined;
};

// What a value holds as `ob_type`, the mark Brython puts on its own values,
// read off the descriptors: every site asking "is this the engine's?" asks
// here. Brython only ever writes it as data, and a JavaScript object is free to
// hold a field or a getter of that name, its author's: read through the getter,
// the question ran their code where no copy would have, ran it twice where the
// copy reads it too, and a getter that throws refused the whole value. A
// proxy's `get` trap is its author's code too, and is not asked either.
//
// What it costs is a descriptor per value asked, measured on 5 000 rows: `to_js`
// 13 ms → 16 ms, `tojson` 31 ms → 35 ms, `to_py` unchanged. A primitive is no
// object Brython marks, and is not asked.
//
// Python operating on a JavaScript object is the engine's own business:
// `$B.get_class` and `$getattr` read `obj.ob_type` themselves, the limit
// `pyScalar` states.
//
// A dict holds its class under a symbol of its own and its string keys as
// properties, so a key "ob_type" is the author's data and no mark: the engine's
// `get_class` takes that symbol first, and this does not read the field there.
export const ownType = (value) =>
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    !Object.hasOwn(value, globalThis.__BRYTHON__.OB_TYPE)
        ? quietly(value, 'ob_type')
        : undefined;

// `pyType`, asked that way: an `ob_type` getter of a JavaScript object is the
// author's code, and a data field of that name is read once, by the serialiser.
// A function too, which the engine's own carry as a field: a Python function
// is the engine's, and a JavaScript one is not.
export const quietPyType = (value) => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined;

    const type = ownType(value) ?? quietly(value, globalThis.__BRYTHON__.OB_TYPE);

    return pyClass(type) ? type : undefined;
};

// A Python scalar held as an object, and the number or the string inside it.
//
// A Brython float is an object holding a number, which is the reason `pyNumbers`
// exists at all: what a framework is handed must be a number, not an object that
// prints like one. Not asked as an identity, `ob_type === float`: a *subclass*,
// `class Price(float)`, is an ordinary business type, and it crosses as its
// number, as `int` and `str` subclasses cross as theirs.
//
// Read from the MRO, which begins at the class itself, so the exact type and the
// subclass take the same path, as `is_dict` and the two sets do. Where the
// value sits is Brython's layout: `value` for a number, `$brython_value` for a
// string.
//
// What does **not** cross is anything else the subclass holds. `Price(0.25)`
// with a `currency` attribute crosses as `0.25`: a value that *is* a number
// crosses as its number, and its fields stay in Python, which is the same
// sentence as the one a callable gets.
export const pyScalar = (value) => {
    const type = value !== null && typeof value === 'object' ? ownType(value) : undefined;

    if (!pyClass(type)) return undefined;

    // **A limit.** `ob_type` is a public key, so a JavaScript object can carry
    // one, and a field holding a real Brython class walks past the check meant
    // for a business *string*: `{ob_type: float, value: 42, label: "kept"}`
    // crosses as the number `42` and the `label` beside it is gone.
    //
    // Looking cannot close it, not even the prototype, since a float that has
    // crossed a boundary is a plain object too: **a genuine Brython float and
    // `{ob_type: float, value: 42}` are the same object**, field for field, on
    // the paths that matter. What would close it is provenance, the engine
    // marking what it made, and that is Brython's to give, not ours to infer.
    // So the contract: a value carrying a Brython class under `ob_type` **is**
    // that value here, and `tests/helpers.test.js` pins it.

    const mro = type.tp_mro;

    if (!Array.isArray(mro)) return type === _b_.float ? value.value : undefined;
    if (mro.includes(_b_.float) || mro.includes(_b_.int)) return value.value;

    // A str is stored three ways: a JavaScript string; a `String` object, which
    // Brython makes of one holding a character past U+FFFF so as to keep where
    // its surrogate pairs fall; and a subclass's `$brython_value`, one of the
    // first two. JavaScript receives the string itself.
    if (mro.includes(_b_.str)) {
        const text = value.$brython_value ?? value;

        return text instanceof String ? text.valueOf() : typeof text === 'string' ? text : undefined;
    }

    return undefined;
};

// A value read by JavaScript off a store: a scalar as JavaScript's own, a float
// a number, `None` its `null`, which a JavaScript reader takes for an absence,
// and a container as itself, since its identity is what a mutation is followed
// by. The read half of the store's setter, which takes `__pyArg`, and the door
// of a context and of a `bindable` handed back to a parent.
export const plainScalar = (value) => {
    if (value === NONE) return null;

    const scalar = pyScalar(value);
    return scalar === undefined ? value : scalar;
};
