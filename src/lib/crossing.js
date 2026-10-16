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

// Then the shapes of what crosses: a bag of keys, an instance of the author's,
// a class's declarations, an object of getters and setters, a container, and
// the pairs of a mapping, each read without running the author's code.

// Whether an object is a bag of keys, or something of a class of its own: a
// Response, a URL, a Date, a Map, a Promise, any of which a `load()` may hand
// straight back and whose keys copied would destroy it.
//
// Read on the prototype and not as `value.constructor`, which a dict may carry
// as data: `{"constructor": "invoice"}` would answer a constructor of its own.
// A Brython dict and a plain object both sit on `Object.prototype`, and a
// **null** prototype is the other bag of keys: `Object.create(null)`, what
// `Object.groupBy` returns, and a module namespace object.
//
// One predicate for every crossing that asks it, `branch`, `mapping()` in
// helpers.js and `urlencode`, so `to_js`, `tojson` and a query string agree on
// what a bag of keys is.
//
// And a **root** prototype rather than *our* `Object.prototype`: an object built
// by another JavaScript context sits on that context's `Object.prototype`, and
// is a bag of keys by every use. *Root* is what every realm's `Object.prototype`
// has in common: a `Date` sits on `Date.prototype`, which sits on
// `Object.prototype` in turn, so it is two steps from null and stays excluded,
// here and in every other realm.
//
// Rootless is not enough on its own. `class Thing extends null {}` is valid
// JavaScript and its prototype is rootless too, and an instance carrying a
// method must not be flattened into its fields. What separates the two is that
// a realm's `Object.prototype` **is** the object protocol: `hasOwnProperty` is
// its own property, where a class prototype's own properties are the author's
// plus `constructor`. Called generically, because the function has to work on a
// prototype from any realm, including one whose own `hasOwnProperty` is exactly
// what is being looked for.
export const plainObject = (value) => {
    const prototype = Object.getPrototypeOf(value);

    if (prototype === null) return true;

    return (
        Object.getPrototypeOf(prototype) === null &&
        Object.prototype.hasOwnProperty.call(prototype, 'hasOwnProperty')
    );
};

// Where a Brython instance keeps the attributes an author wrote, which is a
// symbol and therefore invisible to `Object.keys`.
//
// **Asked of Brython, not discovered**: `$B.DICT` is published by `py_type.js`,
// and a list subclass, an array *and* an instance, answers it as any instance
// does, whatever was watched before it.
export function ownAttributes(value) {
    const dict = globalThis.__BRYTHON__.DICT;

    return dict === undefined ? undefined : value[dict];
}

// An instance of a class of the author's, which is its attributes: its
// `__dict__`, its slots, or both. What the copy writes of it and what its view
// reads.
//
// A value that **descends from a builtin** is not an instance of the author's.
// A `complex` has an instance dictionary and it is empty, so its fields would
// be `{}`, the arm meant for what an author put on their own object; a mapping
// is its entries and a list its rows.
//
// Asked of the **MRO**, not of the class by identity: `class Money(complex)`
// is not the entry in Brython's table, and asked by identity it would come out
// as its attributes, the number gone. Asked against Brython's own table rather
// than a list of type names written here, and `object` is excluded because
// every class descends from it. A class is an instance of `type`, a builtin.
export function authoredInstance(value) {
    const type = ownType(value);

    if (!pyClass(type)) return false;
    if (Array.isArray(type.tp_mro) && type.tp_mro.some((one) => one !== _b_.object && _b_[one.tp_name] === one)) {
        return false;
    }

    const attributes = ownAttributes(value);

    return (attributes !== null && typeof attributes === 'object') || declaresSlots(value);
}

// A name declared by a class **or by one of its bases**, read from the class
// dictionaries rather than through the attribute protocol, so nothing of the
// author's runs while a value is merely being converted.
//
// `$B.search_in_dict` reads one dictionary and stops, so the chain is walked
// here: an instance whose `__call__` is defined on a base class is callable, and
// a subclass that inherits `__slots__` without redeclaring them crosses to
// JavaScript with its fields.
//
// The loop is Brython's own: `super.__getattribute__` asks `search_in_dict` once
// per class of the MRO. `tp_mro` begins at the class itself (`[cls, ...bases,
// object]`) and ends at `object`, which declares neither of the two names asked
// here, so nothing is dragged in by the chain being longer. `type` does carry
// `__call__`, and a class is turned away before the question is asked.
export const declares = (cls, name) => {
    const $B = globalThis.__BRYTHON__;

    for (const one of Array.isArray(cls.tp_mro) ? cls.tp_mro : [cls]) {
        const found = $B.search_in_dict(one, name, $B.NULL);

        if (found !== $B.NULL) return found;
    }

    return $B.NULL;
};

// Whether this object's *class* declares `__slots__`, which is the question, and
// not whether the object happens to carry a property whose name begins like
// one.
//
// Read from the type, for two reasons that are the same reason. A plain
// JavaScript object `{slot_value_price: 42, currency: "EUR"}` is data, whose
// property names say nothing about slots. And an instance whose slots are all
// still unassigned carries no storage at all, so the object alone would say
// "not an instance" of what is one.
//
// A type answers both: it declares its slots before any of them is filled, and
// no object of the author's declares anything.
export const declaresSlots = (value) => {
    const $B = globalThis.__BRYTHON__;

    const type = pyType(value);

    if (type === undefined) return false;

    return declares(type, '__slots__') !== $B.NULL;
};

// Whether a property the copy would read is a getter or a setter: an own
// enumerable one of `value`, under a string or a symbol, read off its
// descriptors and running neither. One the copy does not read, as a spread
// does not, leaves the object a dict to Python, as it leaves any other.
export const behaves = (value) =>
    Reflect.ownKeys(value).some((key) => {
        const one = Reflect.getOwnPropertyDescriptor(value, key);

        return one !== undefined && one.enumerable && (one.get !== undefined || one.set !== undefined);
    });

// A list, a tuple or a dict of Python's, walked as it is stored (`heldStates`).
export const pyContainer = (value) =>
    Array.isArray(value) ? ownType(value) !== undefined : globalThis.__BRYTHON__.is_dict(value);

// Every pair of a mapping, which for a Python dict is not `Object.keys`.
//
// A Brython dict has two halves: string keys are ordinary JavaScript properties,
// which is what makes `d["a"]` as fast as a native read, and everything else
// lives in a hash table under symbols: a property name is always a string, and
// Python keeps `1` and `"1"` apart. Walking the properties would read the fast
// half and drop the rest: a table indexed by id, and an entry whose key is
// `__proto__`, which cannot be an ordinary property either and lives in the
// table too.
//
// Asked of Python, which is the only half that knows both.
// `dict.$iter_items` rather than `items()`, and that is not an optimisation:
// the reactive tracking intercepts `call_attr`, and `items` is one of the calls
// it answers by handing the watch to the children, through this function. Going
// through Python's own method would call it again, for ever.
export function pyEntries(value) {
    const $B = globalThis.__BRYTHON__;

    if (!$B.is_dict(value)) return Object.entries(value);

    return [...$B.builtins.dict.$iter_items(value)].map((entry) => [entry.key, entry.value]);
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
// Duck-typed, and the identity for anything else: a module called from
// ordinary JavaScript keeps its arguments untouched.
// A JavaScript absence, `null` or `undefined`, is Python's `None` in it, as
// `pyData` says at its root: `event["params"]["slug"] is None` has to answer the
// way the author wrote it.
export function pyDict(entries) {
    const $B = globalThis.__BRYTHON__;
    const out = _b_.dict.$factory();

    for (const [key, value] of entries) $B.$setitem(out, key, value ?? NONE);
    return out;
}
