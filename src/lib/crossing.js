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

// What the host answers, handed over by it as it loads: whether one of its
// states owns a value (`owns`), and how it makes an object its state
// (`adopt`). Svelte's are `runtime.js`'s. With no host, no state owns anything
// and an object stays as it is.
export const host = { owns: () => false, adopt: null };

// What the rest of the runtime still lends the crossing: how a function
// crosses in (`functionIn`), and the pair a Python write is handing over right
// now (`handed`, which `handOver` sets), the number and the value it was
// written as.
export const lent = { functionIn: (value) => value, handed: null };

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

// Then bytes and sets, which cross as JavaScript's own kinds, and the
// registries a view is known by.

// The two Python sets, asked by class the way the dict above is. Anything else
// carrying a `$store` is not one, and a foreign object is not walked at all.
// Python's `bytes` and `bytearray`, which have no JSON in CPython either:
// `json.dumps(b"hi")` answers *Object of type bytes is not JSON serializable*.
// Here they are `{ob_type, source}`, so they are asked first, and the refusal
// names the value rather than its class.
//
// Asked of the MRO rather than of the class by identity, so a subclass answers
// too, as in `pyScalar` and `isSet`.
export const pyBytes = (value) => {
    const cls = ownType(value);
    const mro = pyClass(cls) ? cls.tp_mro : undefined;

    if (!Array.isArray(mro)) return false;

    return mro.includes(_b_.bytes) || mro.includes(_b_.bytearray);
};

// bytes as JavaScript holds bytes, a `Uint8Array` of them: what every Web API
// that takes binary data accepts, a `Blob`, a `fetch` body, a `TextDecoder`,
// where the Brython object was written out as "[object Object]". No live
// object can be one: a view is refused by those APIs or written out as text,
// and Chrome refuses a typed array over a buffer that grows. So a copy, of the
// bytes held at the crossing: exact for `bytes`, which never change, and for a
// `bytearray` the bytes of that moment, which an export takes again at each
// change (`liveExport`) and a prop at each render.
export const mutableBytes = (value) => ownType(value).tp_mro.includes(_b_.bytearray);

// The bytes each copy was made of, for the way back (`bytesIn`).
const BYTES_OF = new WeakMap();

// The way back of every object crossing from JavaScript is the engine's own
// lookup (`PYOBJ_MAP`), a method's result among them, which `inbound` never
// sees. A copy of bytes is told there by what it holds now (`bytesIn`): the
// copy was registered as the bytes it was made of, and a method that wrote
// into it handed those back unchanged. Put in place at the first copy, so a
// program that hands JavaScript no bytes pays nothing at that lookup, which
// every object crossing asks.
let bytesLookedUp = false;

const lookUpBytes = () => {
    if (bytesLookedUp) return;

    bytesLookedUp = true;

    const get = WeakMap.prototype.get;

    globalThis.__BRYTHON__.PYOBJ_MAP.get = function (key) {
        return BYTES_OF.has(key) ? bytesIn(key) : get.call(this, key);
    };
};

export const bytesOut = (value) => {
    const out = Uint8Array.from(value.source);

    lookUpBytes();
    BYTES_OF.set(out, value);

    return out;
};

// A copy of bytes handed back to Python: the object it was made of while the
// two hold the same bytes, and a new one of the same kind, bytes or a
// `bytearray`, of what the copy holds once either moved on: JavaScript writes
// into a `Uint8Array`, and Python appends to a `bytearray`. Undefined for any
// other value. The engine's own lookup asks it too (`lookUpBytes`).
export const bytesIn = (value) => {
    const original = BYTES_OF.get(value);

    if (original === undefined) return undefined;

    const held = original.source;

    if (held.length === value.length && held.every((one, at) => one === value[at])) return original;

    const mutable = mutableBytes(original);
    const fresh = (mutable ? _b_.bytearray : _b_.bytes).$factory(globalThis.__BRYTHON__.$list(Array.from(value)));

    BYTES_OF.set(value, fresh);

    return fresh;
};

export const isSet = (value) => {
    const cls = quietPyType(value);

    if (cls === undefined || value.$store === undefined) return false;
    if (cls === _b_.set || cls === _b_.frozenset) return true;

    // A subclass is a set. `class Bag(set): pass` redefines nothing and is an
    // ordinary way to name a domain type, so its members come under watch as a
    // set's do.
    //
    // Read from the type's own ancestry rather than through `isinstance`, which
    // goes through `__instancecheck__` and would run a protocol of the author's
    // while the walk is in flight. The `$store` test above stays: a foreign
    // object carrying that name is not a set.
    return Array.isArray(cls.tp_mro) && (cls.tp_mro.includes(_b_.set) || cls.tp_mro.includes(_b_.frozenset));
};

// **A Python list, tuple or dict that a JavaScript component reads is read
// through a view**, as Svelte hands a child a `$state` object: a proxy whose
// every read subscribes the reader. Handed the container itself, a JavaScript
// child would read a dict's keys as plain properties, which nothing follows,
// and stay where it was when `state["count"] += 1` repaints every Python
// reader, the dict given as a prop or through a context alike.
//
// A read gives what the same value gives at the other doors: None is `null`, as
// `plainData` writes it inside a container, a scalar is JavaScript's own, a
// callable is adapted (`pyHandler`), and a container inside is a view in its
// turn. A write is Python's own `obj[key] = value`, `append` or `del`, so it
// notifies as the same line written in Python does.
//
// One view per container, so a reader comparing what it holds finds the same
// object. And the engine's own map hands the container back: `jsobj2pyobj` and
// `pyBind` read it, so a view that comes back to Python, as a prop, a context, a
// binding or an argument, is the container again.
export const VIEW_OF = new WeakMap();
export const VIEWED = new WeakSet();

// A view's prototype is not `Array.prototype` or `Object.prototype` itself, only
// inherits from it: Svelte wraps a plain array or object put in a `$state` in a
// proxy of its own, which keeps every write to itself, so a JavaScript parent
// that binds a Python list would push into a copy Python never sees, and a
// write to a dict stopped there as well. Not being one, by identity, is what
// tells Svelte to keep the view as it is. Every method, the iterator and
// `Array.isArray` are the array's.
export const LIST_VIEW = Object.create(Array.prototype);

// And a dict's or an instance's carries `Object.prototype`'s own names, each
// the same property: SvelteKit's serialiser (`devalue`) takes an object for a
// plain one by those names, as it takes one from another realm, so a view in
// a `load`'s data is written out as the object it reads as, where Svelte's
// test by identity still keeps it.
export const PLAIN_VIEW = Object.defineProperties(Object.create(Object.prototype), Object.getOwnPropertyDescriptors(Object.prototype));

// Then what JavaScript hands Python: a scalar, a value written, a copy.

// A scalar entering Python, wherever it enters from. One rule for the four
// doors, because the same value had different capabilities behind each: a
// binding's write-back, an imported constant, an argument handed to an exported
// function, and `to_py` itself.
//
// Brython reads a JavaScript number as an `int` when it is whole and as a
// `JSObject` when it is not: a `type="number"` field, the one input Svelte
// converts for you, wrote `0.42` into a name whose `type()` was then `JSObject`.
// It prints `0.42`, so the page looks right, and `round(x, 1)` raises. The same
// crossing in a group turned `value={1}` into the string "1".
//
// `jsobj2pyobj` is the conversion, and Brython owns its three rules: a whole
// number stays an int, one past 2^53 becomes a BigInt, anything else becomes a
// float. Numbers alone: `bind:this` hands over a DOM node and `bind:files` a
// FileList, and those must cross as they are. Idempotent, so the group may ask
// for it early, to compare, and the write may ask again.
//
// An absence is None, the rule `pyArg` and `pyData` keep: a cleared number
// field hands over `null`, and `value is None` has to say so.
export const pyBind = (value) => {
    if (value === null || value === undefined) return NONE;

    // The number a Python write is handing over right now (`handOver`) is the
    // value it was written as.
    const handed = lent.handed;

    if (handed !== null && Object.is(value, handed.js)) return handed.py;
    if (typeof value === 'number') return globalThis.__BRYTHON__.jsobj2pyobj(value);

    // A function as every door takes one (`functionIn`): a function
    // `pyHandler` published is its callable, a JavaScript one is adapted.
    if (typeof value === 'function') return lent.functionIn(value);

    // A view a JavaScript reader was handed (`viewOf`) is its container again,
    // and a copy of bytes the bytes it holds.
    if (VIEWED.has(value)) return globalThis.__BRYTHON__.PYOBJ_MAP.get(value);

    return bytesIn(value) ?? value;
};

// The inbound twin of `plainData`: a JavaScript value as real Python. The walk
// is Brython's own `JSObj.to_dict()`; what is left here is the root, which a
// method on an object cannot speak for: a scalar, a null, a bare array.
//
// What it buys, on a value that only ever crossed from JavaScript: `.get()`,
// `.items()` and `isinstance(x, dict)`. Without it, `.get` and `.keys` raise
// AttributeError while `.items` silently returns the *value* of a key spelled
// "items", a failure whose shape depends on the data.
export function pyData(value, made, live = false) {
    const $B = globalThis.__BRYTHON__;

    if (value === undefined || value === null) return NONE;

    if (typeof value !== 'object') return pyBind(value);

    // A view a JavaScript reader was handed is its container again, at any
    // depth: `{item: values.original}` holds the dict itself, not a copy of it.
    if (VIEWED.has(value)) return pyBind(value);

    // Written into a view, an object a state owns is itself (`entering`).
    if (live && host.owns(value)) return pyBind(value);

    // And one whose properties are a getter or a setter becomes the host's
    // state, as Svelte makes it when it is put into a state: its getters and
    // setters read and write through Svelte's proxy, which follows its other
    // properties too. Copied, the getter was read once and the setter never
    // called; kept as it was, nothing followed what it held.
    if (live && behaves(value)) return pyBind(host.adopt === null ? value : host.adopt(value));

    // A Brython list and a Brython tuple are JavaScript arrays too, told apart
    // from a foreign one by the `ob_type` they carry, and kept as they are: a
    // tuple stays immutable, and a list stays the object its name holds.
    //
    // A foreign array is rebuilt, and a JavaScript array belongs to a graph
    // rather than to a tree: `xs.push(xs)` holds itself, and `[shared, shared]`
    // holds one list twice. So each array is registered *before* its children
    // are walked, and whatever the graph does afterwards finds the list already
    // made.
    if (Array.isArray(value)) {
        // Asked of the *class*, like the object branch below and for the same
        // reason: `ob_type` is a field name, and an array is as free to carry
        // one as an object is: a JavaScript array with a business field of that
        // name is no Brython list, and `to_py(rows)` gives a `list`.
        if (quietPyType(value) !== undefined) return value;

        made ??= new WeakMap();

        const known = made.get(value);
        if (known !== undefined) return known;

        const list = _b_.list.$factory([]);

        made.set(value, list);
        for (const one of value) list.push(pyData(one, made, live));

        return list;
    }

    // The other half of the graph, and the reason it cannot be left to Brython:
    // its `convert_to_python` is tree-only, so `o.self = o` overflows inside
    // *its* frames, and two references to one object come back as two dicts. A
    // cycle does not have to be *in* an object for the object branch to be the
    // one that meets it, since `{"xs": [o]}` enters here.
    //
    // This framework updates by mutation, so two names that stop being one thing
    // is a write that stops arriving.
    //
    // Only a plain object. A Date, a Map, a Response, a DOM node and anything
    // Python already owns keep the crossing they had.
    //
    // Asked as `plainObject`, the predicate written for exactly this question
    // one page up, so the outbound and inbound walks recognise the same
    // objects. One rule, one site.
    //
    // "Is this already a Python object" is not `ob_type === undefined`: that is
    // a *field name*, which data is allowed to carry, `{"ob_type": "business",
    // "value": 42}` being ordinary JSON. A real Python object carries a class
    // there, so the question is asked of the class, read without running a
    // getter of that name: each property is read once, by the copy. Asked of
    // both places the engine keeps it (`quietPyType`): a dict keeps its class
    // under a symbol, and was copied, its identity and its non-string keys
    // lost, `to_py({7: 42})` empty.
    if (quietPyType(value) === undefined && plainObject(value)) {
        made ??= new WeakMap();

        const known = made.get(value);
        if (known !== undefined) return known;

        const dict = _b_.dict.$factory();

        made.set(value, dict);

        // Every own enumerable property, as JavaScript's spread and Svelte's
        // proxy take them, a symbol's included: `Object.entries` reads the
        // strings alone, and a library's metadata under a symbol was lost.
        for (const key of Reflect.ownKeys(value)) {
            if (Object.prototype.propertyIsEnumerable.call(value, key)) $B.$setitem(dict, key, pyData(value[key], made, live));
        }

        return dict;
    }

    const python = $B.jsobj2pyobj(value);

    // Idempotent, which it has to be: `jsobj2pyobj` hands back the *original*
    // Python object when the value once came from one, which is what the
    // `PYOBJ` WeakMap is for, and a dict has no `to_dict`, so `to_py` serves as
    // the guard on a boundary, raising on nothing that needs no converting.
    // Only for something that needed converting: `jsobj2pyobj` hands back the
    // *same* object when the value was already Python, and a Python instance
    // that defines `to_dict`, an ordinary serialisation helper, answers a
    // **bound method**, not a JavaScript function. Identity is the test:
    // nothing was converted, so there is nothing to finish.
    if (python === value) return python;

    // **Not reachable from a component, and kept as a belt.** Everything a
    // component can hand this (`js.JSON.parse(…)`, the answer of a `__js__`
    // import) has already crossed `inbound`, so `jsobj2pyobj` gives the same
    // object back and the line above returns first. A mutation sweep says so:
    // inverting the test below calls `null()` on every conversion and no test
    // can tell, because no reachable input gets here. `tests/to-py.test.js`
    // covers what an author can actually write.
    const toDict = $B.$getattr(python, 'to_dict', null);

    return toDict === null ? python : toDict();
}

// What JavaScript writes into a view. A plain object or an array of its own is
// data, made Python's the way `to_py` makes it, so that a later write to it goes
// through a view of its own and is followed: after `rows.push({n: 2})`,
// `rows.at(-1).n = 3` reaches the page as well as the data. Svelte draws the
// same line, making a proxy of exactly those two kinds when one is put
// into its state. Anything else crosses as a binding's value does: a view handed
// back is its container again, and a class instance, a Date or a DOM node keeps
// its identity.
//
// And an object a Svelte state already owns is kept, at any depth (`live`), as
// Svelte keeps a proxy of its own put into its state: copied, a model shared by
// two components stopped being one, and a write made through its owner never
// reached the Python reader.
export const entering = (given) =>
    given !== null &&
    typeof given === 'object' &&
    !VIEWED.has(given) &&
    quietPyType(given) === undefined &&
    (Array.isArray(given) || plainObject(given))
        ? pyData(given, undefined, true)
        : pyBind(given);
