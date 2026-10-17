// What crosses between Python and JavaScript, and how: Bryntime's
// conversions. It reads the engine `bryntime.js` starts before it, and a host
// reaches it through `bryntime.js`, answering through `host` what only it
// knows.
//
// First, what the engine marks as its own: the questions every door asks of a
// value before it decides what the value becomes.
//
// Python's None, so a value JavaScript never gave reads as None rather than
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
// cross alike, since a registry of models is an ordinary thing to hand over
// (a SvelteKit `load()` returning one, for example), so the decision lives in
// this predicate, which every path that meets a class asks.
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
// a number, and a container as itself, since its identity is what a mutation is
// followed by. `None` is JavaScript's `undefined`, as at every door Brython
// opens (`pyobj2jsobj`), and `null` is `javascript.NULL`'s: `null` stands for
// `None` in JSON alone, which has no `undefined`. The read half of the store's
// setter, which takes `__pyArg`, and the door of a context and of a `bindable`
// handed back to a parent.
export const plainScalar = (value) => {
    if (value === NONE) return undefined;

    const scalar = pyScalar(value);
    return scalar === undefined ? value : scalar;
};

// What the host answers, handed over by it as it loads: whether one of its
// states owns a value (`owns`), how it makes an object its state (`adopt`),
// and the name its author knows, which signs every refusal (`name`).
// Svelthon's answer for Svelte's. With no host, no state owns anything, an
// object stays as it is, and a refusal is signed with Bryntime's own name.
//
// And how its reactions read and write, which a watched Python value is
// followed through: whether the code running is a reaction that follows what
// it reads (`reacting`), whether a write would be refused here (`refuses`),
// a subscription a reaction joins by calling it, `start` called with the
// function that tells it and handing back the one that ends it
// (`subscriber`), and a call that reads without following (`untrack`).
// Alone, every read is taken for a reaction's, nothing is refused, nobody
// subscribes, and nothing is followed.
export const host = {
    owns: () => false,
    adopt: null,
    name: 'bryntime',
    reacting: () => true,
    refuses: () => false,
    subscriber: () => () => {},
    untrack: (fn) => fn()
};

// What the host still lends the crossing: how a function crosses in
// (`functionIn`) and out (`handler`), the pair a Python write is handing over
// right now (`handed`), the number and the value it was written as, the rows a
// Python iterable yields as JavaScript walks them (`seq`), and how a coroutine
// is run (`schedule`). Alone, a
// function crosses as itself both ways and the rows are Python's own
// iteration, followed by nothing; a coroutine has nothing to run it.
export const lent = {
    functionIn: (value) => value,
    handler: (value) => value,
    handed: null,
    seq: (value) => iterated(value),
    schedule: null
};

// Then the shapes of what crosses: a bag of keys, an instance of the author's,
// a class's declarations, an object of getters and setters, a container, and
// the pairs of a mapping, each read without running the author's code.

// Whether an object is a bag of keys, or something of a class of its own: a
// Response, a URL, a Date, a Map, a Promise, any of which Python may hand
// straight back (from a SvelteKit `load()`, say) and whose keys copied would
// destroy it.
//
// Read on the prototype and not as `value.constructor`, which a dict may carry
// as data: `{"constructor": "invoice"}` would answer a constructor of its own.
// A Brython dict and a plain object both sit on `Object.prototype`, and a
// **null** prototype is the other bag of keys: `Object.create(null)`, what
// `Object.groupBy` returns, and a module namespace object.
//
// One predicate for every crossing that asks it, `branch` here and a host's
// own serialisers (Svelthon's `tojson` and `urlencode`), so a copy, JSON and a
// query string agree on what a bag of keys is.
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

// What a framework hands *in* to an exported function.
//
// SvelteKit's request event, for one, carries `params` and `url` wrapped in proxies that
// record every key read, so it knows what a `load()` depended on. Brython probes
// an object's symbols when it wraps it for Python, those symbols land in the
// recorded set, and SvelteKit's serialiser then refuses them. Python must
// therefore never touch the proxy: the boundary reads it here, in JavaScript,
// and hands over a snapshot Python can rummage through freely.
//
// Duck-typed, and the identity for anything else: a module called from
// ordinary JavaScript keeps its arguments untouched.
// JavaScript's `undefined` is Python's `None` in it, and `null` is
// `javascript.NULL`, as the engine pairs them and as `pyData` says at its root.
export function pyDict(entries) {
    const $B = globalThis.__BRYTHON__;
    const out = _b_.dict.$factory();

    for (const [key, value] of entries) $B.$setitem(out, key, value === undefined ? NONE : value);
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
// `bytearray` the bytes of that moment, which the host takes again whenever it
// hands the value over (Svelthon, at each change of an export and each render
// of a prop).
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

// **A Python list, tuple or dict that JavaScript reads is read through a
// view**: a proxy whose every read subscribes the reader, as Svelte hands a
// child a `$state` object. Handed the container itself, a JavaScript reader
// would read a dict's keys as plain properties, which nothing follows, and
// stay where it was when `state["count"] += 1` repaints every Python reader,
// however the dict reached it (a Svelte prop or context, for one).
//
// A read gives what the same value gives at the other doors: None is
// `undefined`, a scalar is JavaScript's own, a callable is adapted
// (`lent.handler`), and a container inside is a view in its turn. A write is Python's own `obj[key] = value`, `append` or `del`, so it
// notifies as the same line written in Python does.
//
// One view per container, so a reader comparing what it holds finds the same
// object. And the engine's own map hands the container back: `jsobj2pyobj` and
// `pyBind` read it, so a view that comes back to Python, by whatever door, a
// binding or an argument among them, is the container again.
export const VIEW_OF = new WeakMap();
export const VIEWED = new WeakSet();

// A view's prototype is not `Array.prototype` or `Object.prototype` itself, only
// inherits from it: a host that wraps a plain array or object in a proxy of its
// own keeps every write to that proxy (Svelte does it to what a `$state`
// holds), so a JavaScript parent that binds a Python list would push into a
// copy Python never sees, and a write to a dict stopped there as well. Not
// being one, by identity, is what tells such a host to keep the view as it
// is. Every method, the iterator and `Array.isArray` are the array's.
export const LIST_VIEW = Object.create(Array.prototype);

// And a dict's or an instance's carries `Object.prototype`'s own names, each
// the same property: a serialiser that takes an object for a plain one by
// those names, as it takes one from another realm (`devalue`, SvelteKit's),
// writes a view out as the object it reads as, where a test by identity still
// keeps it.
export const PLAIN_VIEW = Object.defineProperties(Object.create(Object.prototype), Object.getOwnPropertyDescriptors(Object.prototype));

// Then what JavaScript hands Python: a scalar, a value written, a copy.

// A scalar entering Python, wherever it enters from. One rule for the four
// doors, because the same value had different capabilities behind each: a
// binding's write-back, an imported constant, an argument handed to an exported
// function, and `to_py` itself.
//
// Brython reads a JavaScript number as an `int` when it is whole and as a
// `JSObject` when it is not: a `type="number"` field, whose value Svelte's
// binding hands over as a number, wrote `0.42` into a name whose `type()` was
// then `JSObject`.
// It prints `0.42`, so the page looks right, and `round(x, 1)` raises. The same
// crossing in a group turned `value={1}` into the string "1".
//
// `jsobj2pyobj` is the conversion, and Brython owns its three rules: a whole
// number stays an int, one past 2^53 becomes a BigInt, anything else becomes a
// float. Numbers alone: `bind:this` hands over a DOM node and `bind:files` a
// FileList, and those must cross as they are. Idempotent, so the group may ask
// for it early, to compare, and the write may ask again.
//
// `undefined` is None and `null` is `javascript.NULL`, the engine's two
// pairings, which `pyArg` and `pyData` keep too: a cleared number field hands
// over `null`, and Python reads the `null` it is.
export const pyBind = (value) => {
    if (value === undefined) return NONE;
    if (value === null) return null;

    // The number a Python write is handing over right now (`lent.handed`) is
    // the value it was written as.
    const handed = lent.handed;

    if (handed !== null && Object.is(value, handed.js)) return handed.py;
    if (typeof value === 'number') return globalThis.__BRYTHON__.jsobj2pyobj(value);

    // A function as every door takes one (`lent.functionIn`): a function the
    // crossing published is its callable, a JavaScript one is adapted.
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

    if (value === undefined) return NONE;
    if (value === null) return null;

    if (typeof value !== 'object') return pyBind(value);

    // A view a JavaScript reader was handed is its container again, at any
    // depth: `{item: values.original}` holds the dict itself, not a copy of it.
    if (VIEWED.has(value)) return pyBind(value);

    // Written into a view, an object a state owns is itself (`entering`).
    if (live && host.owns(value)) return pyBind(value);

    // And one whose properties are a getter or a setter becomes the host's
    // state (`host.adopt`), as Svelte makes such an object when it is put into
    // a state: its getters and setters read and write through the host's
    // proxy, which follows its other properties too. Copied, the getter was
    // read once and the setter never called; kept as it was, nothing followed
    // what it held.
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
    // A reader follows a value by its mutations, so two names that stop being
    // one thing is a write that stops arriving.
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

        // Every own enumerable property, as JavaScript's spread takes them, a
        // symbol's included: `Object.entries` reads the strings alone, and a
        // library's metadata under a symbol was lost.
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

    // **Not reachable from Python, and kept as a belt.** Everything Python can
    // hand this (`js.JSON.parse(…)`, the answer of a `__js__` import) has
    // already crossed `inbound`, so `jsobj2pyobj` gives the same
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
// `rows.at(-1).n = 3` reaches the reader as well as the data. Svelte draws the
// same line, making a proxy of exactly those two kinds when one is put
// into its state. Anything else crosses as a binding's value does: a view handed
// back is its container again, and a class instance, a Date or a DOM node keeps
// its identity.
//
// And an object a state of the host already owns (`host.owns`) is kept, at any
// depth (`live`), as Svelte keeps a proxy of its own put into its state:
// copied, a model shared by two readers stopped being one, and a write made
// through its owner never reached the Python reader.
export const entering = (given) =>
    given !== null &&
    typeof given === 'object' &&
    !VIEWED.has(given) &&
    quietPyType(given) === undefined &&
    (Array.isArray(given) || plainObject(given))
        ? pyData(given, undefined, true)
        : pyBind(given);

// Then what Python hands JavaScript: the rows of a sequence, the objects
// JavaScript keeps as its own, what is awaited and what is called, and the
// copy, `to_js` and the serialiser's.

// An array-shaped Python value, as *its class* says it iterates.
//
// A Brython list is a JavaScript array, so anywhere this file walks elements it
// can walk the storage with no conversion at all, and for a list or a tuple that
// is exactly right. It stops being right the moment a subclass redefines
// `__iter__`: `[x for x in rows]` may answer `[3, 2, 1]` for a storage of
// `[1, 2, 3]`, and whatever walks it from JavaScript (a template's loop, the
// crossing, a serialiser) answers what Python answers. The storage is not the
// sequence when the author has said otherwise, and this is the one place that
// knows it.
//
// `list()` is not the road: Brython's constructor copies the storage of anything
// array-shaped, so asking it answers the question with the question.
// `make_js_iterator` is, and it carries both of the other obligations. It runs
// `iter()`, the only call that *validates* the protocol: an `__iter__` that
// returns a plain list is a TypeError in Python and from JavaScript alike.
// And it keeps the storage fast path
// exactly where it is still true, since Brython copies that path onto a subclass
// only when the subclass leaves `__iter__` alone.
//
// `$B.NULL` as the frame is how the engine itself calls this from JavaScript:
// there is no Python line to attribute here, and the alternative writes a line
// number into whatever frame happens to be current.
//
// The one walk that does **not** come through here is `mark`, which hands the
// watch to the children an object already holds. Asking a class what it yields
// means running the author's code, and marking happens on the path of every
// mutation; `seq` asks instead, at the one moment the rows are about to be
// rendered, which is where a row that only the iterator yields becomes visible.
export function iterated(value) {
    // Asked of the *class*, as the two converters ask it: `ob_type` is a field
    // name, and a JavaScript array is as free to carry one as an object is,
    // `{ob_type: "business"}` among them. The loop, `batch`, the export,
    // `tojson`, the argument boundary and `plainData` all ask it this way.
    const type = ownType(value);
    const $B = globalThis.__BRYTHON__;

    // A JavaScript array whose iteration is its own, a generator set as its
    // `Symbol.iterator`, yields what Python's `for` yields from it, walked
    // once here: handed on as the array, it was walked again by each reader,
    // the rows a stateful iterator gave a second time, or none at all. The
    // property is read once, a getter's choice made once, and an iterator that
    // is no function refuses as Python's `for` refuses it.
    if (!pyClass(type)) {
        if (!Array.isArray(value)) return value;

        const iterator = value[Symbol.iterator];

        if (iterator === Array.prototype[Symbol.iterator]) return value;
        if (typeof iterator !== 'function') throw new TypeError('obj[Symbol.iterator] is not a function');

        return $B.$list(Array.from({ [Symbol.iterator]: () => Reflect.apply(iterator, value, []) }));
    }

    if (type === _b_.list || type === _b_.tuple) return value;

    return $B.$list(Array.from($B.make_js_iterator(value, $B.NULL)));
}

// An object no Python type marks is JavaScript's, and leaves Python as itself,
// as it leaves a JavaScript function that returns it. What Python writes into
// a JavaScript array or object crosses as it is written, through
// `pyobj2jsobj_hook` and the engine behind it: a number, a str and None as
// JavaScript's, a callable as its handler, a list, a tuple or a dict converted,
// a set and an instance of the author's as their view, bytes as a
// `Uint8Array`. What stays itself is what has no JavaScript face at any door,
// a complex, a range, and a copy left those as they were too. So nothing in one is Python's to convert, and a
// copy would lose its identity and run its getters before whoever reads it has
// asked. The serialiser alone reads one, at its own turn.
export const javascriptOwn = (value) => quietPyType(value) === undefined;

// A native object `JSON.stringify` has nothing to write of: a class of its own,
// no `toJSON` to ask, and no enumerable own property to copy. Its answer is
// `{}`, valid JSON that drops everything the value held: `tojson(new
// Map([["answer", 42]]))` would say `{}`.
//
// Asked as a behaviour and not as a list of names: the question is *what will
// the serialiser do with it*, and the answer covers a Map, a Set, a Headers, a Response and whatever
// the platform adds next. A Date and a URL carry a `toJSON`, which `plainData`
// reads once and hands on before asking this; a `toJSON` that gives no
// function is no hook and keeps nothing from here. A Brython instance is a
// plain object here and never reaches this.
//
// Asked inside a `try` for the reason every recognition is: a value nobody
// vouched for may throw from `ownKeys`, and a question must not be the place
// where that happens.
export const opaque = (value) => {
    try {
        return (
            !Array.isArray(value) &&
            !plainObject(value) &&
            boxed(value) === undefined
        );
    } catch {
        return false;
    }
};

// What `JSON.stringify` writes of an object by an internal slot rather than by
// its properties: a String, a Number, a Boolean or a BigInt object stands for
// its primitive, and `JSON.rawJSON` hands back a text written as it is.
//
// Which of the four an object is, asked of the slot: each type's own `valueOf`
// answers for its slot alone and throws for any other object, whatever tag the
// object shows, and from whichever JavaScript context it was built in. Nothing
// is read: not the tag, which a getter or a proxy's trap may give, and no
// property at all, so no code of the author's runs. Four throws for an
// ordinary object, which is why a JavaScript object's turn asks the serialiser
// instead, and why nothing asks it of a Python value nor of what a walk built.
const SLOTS = [
    ['number', Number.prototype.valueOf],
    ['string', String.prototype.valueOf],
    ['boolean', Boolean.prototype.valueOf],
    ['bigint', BigInt.prototype.valueOf]
];

export const boxed = (value) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined;

    for (const [kind, slot] of SLOTS) {
        try {
            slot.call(value);
            return kind;
        } catch {
            // not this one
        }
    }

    return undefined;
};

// `{ value }`, what the serialiser writes of one of the four, or undefined. A
// Number and a String are converted as `JSON.stringify` converts them, by
// `ToNumber` and `ToString`, so the author's `valueOf`, `toString` or
// `Symbol.toPrimitive` decides; a Boolean and a BigInt are their slot.
export const unboxed = (value) => {
    const kind = boxed(value);

    if (kind === undefined) return undefined;
    if (kind === 'number') return { value: +value };
    if (kind === 'string') return { value: `${value}` };

    return { value: SLOTS.find(([one]) => one === kind)[1].call(value) };
};

export const rawJSON = (value) => typeof JSON.isRawJSON === 'function' && JSON.isRawJSON(value);

// A call that has been made and not finished.
//
// Asked in several places, by the host too, so it is written once and shared.
// Compared in JavaScript rather than through `aio.iscoroutine()`: this runs on
// every call into Python, and a Brython call here costs more than the check
// saves.
//
// Asked of the class the value carries as data (`pyType`), not through
// `$B.get_class`, which reads an `ob_type` getter of a JavaScript object, and
// every value a conversion walks is asked.
export const pyCoroutine = (value) => pyType(value) === globalThis.__BRYTHON__.coroutine;

// What Python hands JavaScript to wait on: a coroutine, which runs once asked
// (`started`), or an `aio.Future`, a promise of Brython's already under way.
// Either crosses as a promise, whatever it resolves to crossing as a value
// returned at once does, and whatever it rejects with as an error raised. The
// class is asked of its module once, and only for a promise.
let futures;

export const pyAwaitable = (value) => {
    if (pyCoroutine(value)) return true;
    if (!(value instanceof Promise)) return false;

    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (aio === undefined) return false;

    futures ??= $B.$getattr(aio, 'Future');

    return pyType(value) === futures;
};

// Awaitable, as the serialiser asks it before writing a value out: a `then` that
// can be called, read off the descriptors as `quietly` reads them. A `then`
// getter is the author's code and `JSON.stringify` never runs it, so the
// question does not either; a promise's `then` is a method, which this finds.
// The call boundary asks `awaited` below, which reads `then` as `await` does.
//
// A Python value is never one: Brython keeps an instance's attributes under a
// symbol, so a plain `.then` read finds nothing on it, and a dict, which keeps
// its string keys as its own properties, is asked by name, since `{"then": f}`
// is a dict of callbacks and not a promise.
export const thenable = (value) =>
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof quietly(value, 'then') === 'function' &&
    !globalThis.__BRYTHON__.is_dict(value);

// The slots of an instance, read through their member descriptors, each from
// the storage it names (`d_member.attr`), so a slot a subclass redeclares is
// its own: by name, the first descriptor of a name along the MRO, as `box.x`
// reads it, for the slots that hold a value; with `all`, every value stored,
// a shadowed slot's too; with `only`, that one name, looked up in each class
// rather than read off all its entries, since a view asks it once per key.
// The one reader of a slot's storage.
export function slotValues(value, all = false, only = null) {
    const $B = globalThis.__BRYTHON__;
    const named = new Map();
    const stored = [];
    const seen = new Set();
    const mro = declaresSlots(value) ? quietPyType(value)?.tp_mro : undefined;

    for (const cls of Array.isArray(mro) ? mro : []) {
        if ((cls.tp_flags & $B.TPFLAGS.HEAPTYPE) === 0) continue;

        const entries = only === null ? pyEntries($B.get_dict(cls)) : [[only, $B.search_in_dict(cls, only, $B.NULL)]];

        for (const [name, member] of entries) {
            if (member === $B.NULL || $B.get_class(member) !== $B.member_descriptor) continue;

            const held = Object.hasOwn(value, member.d_member.attr);

            if (held) stored.push(value[member.d_member.attr]);
            if (!seen.has(name) && held) named.set(name, value[member.d_member.attr]);
            seen.add(name);
        }
    }

    return all ? stored : named;
}

// An instance whose class defines `__call__`, which is an ordinary way to write
// a strategy object and the third shape of *callable in Python*. Answers with
// the `__call__` it found, since that is what carries the signature.
//
// Asked of the class chain, never of the instance: `declares` reads the class
// dictionaries of the MRO, so no getter of the author's runs while a value is
// merely being converted. As in CPython, a plain instance, a list, a dict and a
// str answer no, and an instance of a class that defines `__call__` answers yes.
//
// The chain, and not one dictionary: `class Derived(Strategy): pass` is
// callable as its base is.
//
// A **class** is excluded on purpose: `type` *does* carry `__call__` in
// Brython, so every class named in `__all__` would reach `declared`. A class
// crossing as itself rather than as a wrapper is a decision this file made, and
// it does not rest on the shape of an engine internal.
export const callDescriptor = (value) => {
    const $B = globalThis.__BRYTHON__;

    const type = pyType(value);

    if (type === undefined || pyClass(value) || boundMethod(value)) return null;

    const found = declares(type, '__call__');

    return found === $B.NULL ? null : found;
};

// Callable in Python, which is wider than *is a JavaScript function* and is the
// question every boundary that promises to adapt a callback has to ask.
//
// Exported for the callers outside this file that have to ask the same
// question, a host's serialiser among them: what crosses to JavaScript as a
// call has no JSON, and a second predicate written there would answer
// differently the day this one learns another shape.
export const callable = (value) =>
    typeof value === 'function' ||
    boundMethod(value) ||
    wrapperMethod(value) ||
    callDescriptor(value) !== null ||
    slotCallable(value);

// Any other value Python calls: `list.index`, `list.__setitem__`, the
// descriptors a builtin type hands out, which Brython calls through a `tp_call`
// slot. Python's own `callable()` answers, a class excluded, since a class
// crossing is the class. Some of those descriptors are JavaScript functions
// carrying their type, `dict.get` among them, and are Python's all the same.
export const slotCallable = (value) =>
    quietPyType(value) !== undefined &&
    !pyClass(value) &&
    _b_.callable(value) === true;

// One JavaScript function per such value, so it is one callback however often
// it crosses.
const SLOT_CALLS = new WeakMap();

// Its contract: Python on both sides, no signature to trim to, and Python's
// own call protocol.
export const slotDeclared = (value) => {
    if (!slotCallable(value)) return null;

    const $B = globalThis.__BRYTHON__;
    let fn = SLOT_CALLS.get(value);
    if (fn === undefined) SLOT_CALLS.set(value, (fn = (...args) => $B.$call(value, ...args)));

    return { fn, where: `${value.d_name ?? $B.class_name(value)}() — builtins`, arity: Infinity };
};

// A special method read off a builtin, `rows.__setitem__`: `{ob_type:
// method_wrapper, self, wrapped, d_name}`, which Brython calls through its
// `tp_call` slot rather than a `__call__`, so the class answers what it is.
export const wrapperMethod = (value) =>
    value !== null &&
    typeof value === 'object' &&
    ownType(value) === globalThis.__BRYTHON__.method_wrapper &&
    typeof value.wrapped === 'function';

// A method read off an instance: `{ob_type: method, im_func, im_self}`, which
// `typeof` calls an object. Recognised by its class the way everything else
// here is, and not by the two field names, which are Brython's own
// (`descriptors.js`, `$B.method.tp_new`).
export const boundMethod = (value) =>
    value !== null &&
    typeof value === 'object' &&
    ownType(value) === globalThis.__BRYTHON__.method &&
    typeof value.im_func === 'function';

// A key written, and not assigned. `out[key] = value` runs the setter that
// `__proto__` has on `Object.prototype`, so a dict holding that key would lose
// it, and the object's prototype would be whatever the key held. A key is data
// here, wherever it came from.
// The pairs of a mapping as Python code outside the dict reads them,
// `value.items()`, which is what CPython's `urlencode` and `json.dumps` ask: an
// exact dict's own, and a subclass's through its `items`, which may filter,
// rewrite or refuse. Each row is read by `pair`, the caller's own rule.
// `pyEntries` is the storage, which the tracking needs and which a subclass's
// `items` is not.
export function pyItems(value, pair) {
    const $B = globalThis.__BRYTHON__;

    if (!$B.is_dict(value) || (quietPyType(value) ?? $B.get_class(value)) === _b_.dict) return pyEntries(value);

    return lent.seq($B.$call($B.$getattr(value, 'items'))).map(pair);
}

// `for key, one in rows`, which is how `urlencode` reads a row: any iterable
// of two.
export function unpackedPair(row) {
    const pair = lent.seq(row);

    if (pair.length !== 2) {
        const told = pair.length > 2 ? 'too many' : 'not enough';

        globalThis.__BRYTHON__.RAISE(_b_.ValueError, `${told} values to unpack (expected 2, got ${pair.length})`);
    }

    return pair;
}

// What `json.dumps` takes of a row: a tuple of two, and nothing else.
export function tuplePair(row) {
    if (!Array.isArray(row) || !globalThis.__BRYTHON__.is_tuple(row) || row.length !== 2) {
        globalThis.__BRYTHON__.RAISE(_b_.ValueError, 'items must return 2-tuples');
    }

    return [row[0], row[1]];
}

export const define = (target, key, value) =>
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true
    });

// What a coroutine became, kept against the coroutine itself so that a second
// reference to it is a second reference and not a second run.
//
// Two things, and keeping them apart is the point. `run` is the execution, and
// there is exactly one per coroutine object, forever. `views` holds the
// converted promise per conversion policy, because what the body resolves to
// still has to cross, and how it crosses is the caller's to say: the same
// options dict wants its callbacks wrapped when a JavaScript function is going
// to call them and left alone when `tojson` is going to serialise them. One run,
// one view per policy.
const CROSSED = new WeakMap();

// The promise a coroutine crosses as under one policy, its run shared with every
// other: `convert` is what its result goes through, `policy` the key that says
// which conversion it was.
export const crossedAs = (coroutine, policy, convert) => {
    let crossing = CROSSED.get(coroutine);

    if (crossing === undefined) {
        crossing = { run: lent.schedule(coroutine, 'coroutine'), views: new Map() };

        CROSSED.set(coroutine, crossing);
    }

    let view = crossing.views.get(policy);

    if (view === undefined) {
        view = crossing.run.then(convert);

        crossing.views.set(policy, view);
    }

    return view;
};

// What an exported function hands back to a framework.
//
// A framework serialises what Python returns (SvelteKit, whatever `load()`
// returns), and a Brython dict carries symbol-keyed internals
// (`Symbol(OB_TYPE)`) that a serialiser refuses outright. So the boundary converts: Python containers become plain JavaScript
// data, which is the only shape anything outside Python can read anyway.
// `adapt` is the third caller-said rule, beside the two `seen` carries: what a
// callable, and under the serialiser's rule a value with no JSON, becomes.
// With none, a callable crosses as the view hands it over, adapted
// (`lent.handler`), so `direct(done)` and `nested({"done": done})` call it
// alike; the arguments of a JavaScript call pass a rule of their own, and
// `tojson` its refusal, since JSON cannot hold a call.
// A JavaScript object's turn in `JSON.stringify`, which is what the serialiser
// does there: its `toJSON` read once and called with the object and the key,
// then what came of it written. A primitive, a raw text, a boxed scalar and a
// Python value are written as they always are. An array or an object comes out
// as a copy whose every part is read when the serialiser reaches it, by a
// getter, so a hook still sees what the hooks before it changed. What has no
// JSON is refused: an object of a class of its own that gave no hook, and one a
// hook gave back with nothing enumerable to write, a Map. One that gave itself
// back is written, as the serialiser writes it, by its own properties.
//
// The copies a turn made, already asked everything: what reads them next is the
// serialiser, and a question of the replacer's would run their getters, which
// read the author's, a second time. And the containers the walk built for a
// Python value, which are ours and hold nothing to ask of them.
const COPIES = new WeakSet();

export const jsonCopy = (value) => COPIES.has(value);

// The stand-in the serialiser is asked about an object through: one for every
// turn rather than one made at each, and emptied as it is read, so it holds on
// to nothing.
const PROBE = {
    held: undefined,
    toJSON() {
        const one = this.held;

        this.held = undefined;

        return one;
    }
};
const NO_KEY = Object.freeze([]);

// A copy is made at every turn, its keys and its length read then, as the
// serialiser reads them for each occurrence. `chain` is the objects being
// written around this one, so a loop raises as the serialiser raises.
function turn(value, key, seen, adapt, chain) {
    const hook = value.toJSON;
    const hooked = typeof hook === 'function';
    const result = hooked ? Reflect.apply(hook, value, [key]) : value;

    if (result === null || typeof result !== 'object' || quietPyType(result) !== undefined) {
        return plainData(result, seen, adapt);
    }

    if (rawJSON(result)) return result;

    // A Number, a String, a Boolean or a BigInt object is written by its slot,
    // and the serialiser tells one from any other object without reading it:
    // told to write no key, it writes `{}` of any other object, with no read and
    // no trap, and converts one of the four as it does at its turn, once. What
    // it wrote is the value. A number with no JSON is handed on for the refusal
    // to name, and a BigInt object, which it refuses, is a big integer here as
    // a BigInt is.
    if (!Array.isArray(result)) {
        let written;

        try {
            PROBE.held = result;
            written = JSON.stringify(PROBE, NO_KEY);
        } catch (error) {
            if (boxed(result) === 'bigint') return result;
            throw error;
        }

        if (written === 'null') return result;
        if (written !== '{}') return JSON.parse(written);
    }

    if (chain.includes(result)) throw new TypeError('Converting circular structure to JSON');
    if (thenable(result)) return adapt(result);

    // Neither ordinary nor one of the four is an object of a class of its own,
    // refused unless a hook gave it back with something enumerable to write.
    // Its keys are read once, as the serialiser reads them, and the copy is
    // made of those.
    const ordinary = Array.isArray(result) || plainObject(result);

    if (!ordinary && !hooked) return adapt(result);

    const names = Array.isArray(result) ? Array.from({ length: result.length }, (_, i) => i) : Object.keys(result);

    if (!ordinary && names.length === 0) return adapt(result);

    const copy = Array.isArray(result) ? [] : {};

    COPIES.add(copy);
    const inner = [...chain, result];

    for (const name of names) {
        Object.defineProperty(copy, name, {
            enumerable: true,
            configurable: true,
            get: () => {
                const outer = seen.chain;

                seen.chain = inner;
                try {
                    return plainData(result[name], seen, adapt);
                } finally {
                    seen.chain = outer;
                }
            }
        });
    }

    return copy;
}

// The builtin containers, of which no instance is callable.
const CONTAINERS = new Set([_b_.list, _b_.tuple, _b_.dict, _b_.set, _b_.frozenset, _b_.bytes, _b_.bytearray]);

export function plainData(value, seen, adapt) {
    // `None` is JavaScript's `undefined` and `null` stays `null`, as at every
    // door, but under the serialiser's rule, which writes JSON, where each of
    // them is `null`.
    if (value === undefined || value === null || value === NONE) {
        return adapt !== undefined && seen instanceof Set ? null : value === NONE ? undefined : value;
    }

    // A callable crosses as the view hands one over, adapted (`lent.handler`),
    // unless the caller has a rule of its own (`adapt`): a copy is what
    // JavaScript reads through the view, and a raw function took every
    // argument JavaScript passed where the view's took those it declares.
    if (typeof value === 'function') return adapt === undefined ? lent.handler(value) : adapt(value);

    // A view handed back is its container again, as at every other door: a
    // value a Python function returned and JavaScript hands to `tojson` is the
    // Python value it reads, not a JavaScript object.
    if (VIEWED.has(value)) value = globalThis.__BRYTHON__.PYOBJ_MAP.get(value);

    // Under the serialiser's rule, a JavaScript object is handed on as a
    // stand-in whose `toJSON` the serialiser calls at the object's own turn,
    // with its key, and nothing of it is read before then: not its fields, not
    // its hook, and not a getter that happens to be called `ob_type` or `then`,
    // which is why it is told from a Python value by its descriptors. A raw JSON
    // text is the serialiser's own and stays as it is; a boxed scalar takes its
    // turn like any object, and its turn hands it back as it is.
    if (
        adapt !== undefined &&
        seen instanceof Set &&
        typeof value === 'object' &&
        quietPyType(value) === undefined &&
        !rawJSON(value)
    ) {
        const chain = seen.chain ?? [];

        return { toJSON: (key) => turn(value, key, seen, adapt, chain) };
    }

    // A callable that `typeof` calls an object (a bound method, an instance
    // whose class defines `__call__`), under a caller's rule; with none, it is
    // asked below, of the values that can be one.
    if (adapt !== undefined && callable(value)) return adapt(value);

    // A **symbol**, under the serialiser's rule only, and the last silent loss
    // of this shape: `JSON.stringify` drops one wherever it stands, so
    // `tojson(marker)` wrote nothing at all and `{"id": marker}` wrote `{}`. It
    // is not an object, so the arm has to stand above the line below rather than
    // beside the other three.
    if (adapt !== undefined && seen instanceof Set && typeof value === 'symbol') {
        return adapt(value);
    }

    if (typeof value !== 'object') return value;

    // A Brython float is an object holding a number and a reference to its
    // type. `tojson(1 / 3)` walks the lot: 20 KB of `ob_type`. A subclass of one
    // takes the same road, with the same answer.
    const scalar = pyScalar(value);

    if (scalar !== undefined) return scalar;


    // The shapes with no JSON, asked before the walk and under the serialiser's
    // rule only. Every other caller hands its result to JavaScript, where a
    // promise is exactly what is wanted and a Map is a Map.
    //
    // A promise keeps its result where nothing enumerable can reach it, so it
    // would serialise as `{}`, an empty object that looks like an answer. Here
    // and not in the replacer, because the replacer sees a *bare* thenable only
    // after the walk has met the `then` inside it: asked before the walk, a
    // promise and a thenable get the same sentence, about promises.
    //
    // A **Python set** is here because the walk would reach its internals
    // first: it is a plain object holding `$store` and `ob_type`, so its class
    // would be named instead of what the author passed.
    if (
        adapt !== undefined &&
        seen instanceof Set &&
        (thenable(value) || isSet(value) || pyBytes(value) || opaque(value))
    ) {
        return adapt(value);
    }

    // A coroutine handed to JavaScript becomes a promise, which JavaScript can
    // wait on: a SvelteKit `load()` streams that way, `{"lentes":
    // chercher_lentement()}` returning a coroutine. An `aio.Future` is one
    // already, whose result crosses the same way.
    if (pyAwaitable(value)) {
        // A walk that cannot wait must not start one.
        //
        // The JSON rule is a serialiser's, and a serialiser is synchronous: the
        // branch below would schedule the body and hand `JSON.stringify` a
        // promise, `{}`, while **running the author's coroutine**. So the
        // caller's own rule decides, before anything is scheduled: the
        // serialiser refuses this shape the way it refuses a class and a call.
        // Every other caller hands its result to JavaScript, where a promise is
        // exactly what is wanted.
        if (adapt !== undefined && seen instanceof Set) return adapt(value);

        // One coroutine object, one run. This branch sits before the graph memo,
        // so it keeps one of its own: a coroutine held under two keys is one
        // promise and one execution of the Python body.
        //
        // Memoised on the coroutine itself rather than inside a traversal,
        // because that is the truth being told: awaiting one coroutine twice is
        // not something Python offers, so two references to it cannot mean two
        // runs under any rule, JSON included. Two distinct coroutine objects are
        // two distinct keys here, and still run once each.
        //
        // What it resolves to is Python too, and has to make the same crossing,
        // under the same rule, so a dict returned behind a coroutine crosses as
        // the same dict returned directly does.
        return crossedAs(value, adapt, (result) => plainData(result, undefined, adapt));
    }

    // Two rules, and the caller says which. Note that `map` passes an index as
    // its second argument, so every recursive call below is written out rather
    // than passing this function by reference.
    //
    // **JSON**: track the *branch being walked*. The same object twice in one
    // list is shared, not circular, and has to come out twice; a loop answers
    // `null`. That is the only thing a serialiser can do, and it is what `tojson`
    // needs.
    //
    // **JavaScript**: keep the graph, the way `pyData` keeps it coming in. This
    // is the default because five of the six consumers are on this side:
    // `to_js` *is* this function, and the emitted code puts it on the return
    // value of every Python function crossing over. JavaScript has identity, and
    // this framework updates by mutation, so a structure handed out with its
    // sharing undone is a write that stops arriving.
    if (seen instanceof Set) {
        if (seen.has(value)) return null;
        seen.add(value);

        try {
            const out = branch(value, seen, undefined, adapt);

            if (out !== value) COPIES.add(out);

            return out;
        } finally {
            seen.delete(value);
        }
    }

    const type = quietPyType(value);

    if (type === undefined) return value;

    // A callable as the view hands one over, adapted: walked as data, a bound
    // method came out as `{}`. Not asked of a builtin container, which is never
    // one: asked of each, it doubled the time of a copy.
    if (!CONTAINERS.has(type) && callable(value)) return lent.handler(value);
    if (pyBytes(value)) return bytesOut(value);

    const made = seen ?? new WeakMap();
    const known = made.get(value);

    if (known !== undefined) return known;

    // Registered before the children are walked, which is what answers a cycle
    // with the object itself rather than with `null`. The shell has to be made
    // before it can be filled, so `branch` is given it to fill.
    const shell = sequence(value) ? [] : {};

    made.set(value, shell);

    const out = branch(value, made, shell, adapt);

    // `branch` hands several kinds of value straight back rather than filling the
    // shell: a Python class, and anything carrying a prototype of its own (a
    // Date, a Map, a Promise, a Response). Registering before the walk is what
    // answers a cycle; the memo then holds whatever `branch` decided, so the
    // second reference to such a value, `[d, d]`, meets the value and not the
    // empty shell.
    if (out !== shell) made.set(value, out);

    return out;
}

// An array that holds rows: a JavaScript one, or a Python list or tuple, a
// subclass included. Brython builds other objects on an array too, a frame
// among them, and those are objects of their own class, whose items are not
// what they are.
export const sequence = (value) => {
    const $B = globalThis.__BRYTHON__;

    return Array.isArray(value) && (pyType(value) === undefined || Boolean($B.is_list(value) || $B.is_tuple(value)));
};

// `shell` is the object the graph rule registered before walking, so a cycle
// found on the way down meets the same one. The JSON rule has none and builds as
// it goes, which is why every `fill` below takes what it was given or makes one.
function branch(value, seen, shell, adapt) {
    // A native object that says how it serialises keeps it, an array, a literal
    // and a class instance alike: `JSON.stringify` calls its `toJSON`,
    // enumerable or not, own or inherited, with the receiver and the key. A
    // Python object with a `toJSON` key or attribute has a class, and is data.
    // Under the serialiser's rule `plainData` has read it already, once.
    if (!(adapt !== undefined && seen instanceof Set) && typeof value.toJSON === 'function' && pyType(value) === undefined) {
        return value;
    }

    // So does a raw JSON text, which has no prototype and would otherwise be
    // copied out as `{rawJSON: "…"}`, the slot that makes it raw left behind,
    // and so does a Number, a String, a Boolean or a BigInt object given no
    // prototype, which would be copied out as `{}`. Any other object of the four
    // is not an ordinary one, and is handed over as it is further down. A Python
    // value is none of the four.
    if (rawJSON(value) || (plainObject(value) && quietPyType(value) === undefined && boxed(value) !== undefined)) {
        return value;
    }

    if (sequence(value)) {
        // list, tuple, and a subclass through whatever it says iterating it
        // means: `json.dumps` of a list subclass in CPython is its `__iter__`
        // too, and JavaScript reads `rows` the same way, by a view or a copy.
        //
        // What `iterated` hands back is walked by its indices: a JavaScript
        // array is its indexed elements, as `JSON.stringify` and a structured
        // clone read it, and not what a `Symbol.iterator` of its own yields.
        const out = shell ?? [];
        const items = iterated(value);

        for (let i = 0; i < items.length; i++) out.push(plainData(items[i], seen, adapt));

        return out;
    }

    // A class is not data to flatten (`pyClass`), at the top or one level
    // down, where a class sits in a dict or a list Python hands over.
    if (pyClass(value)) return value;

    // A set is copied as the `Set` its view reads as, each member copied in
    // turn, and a frozenset too, which JavaScript has no frozen kind of. Handed
    // on as the Python object, it was no set to JavaScript.
    if (isSet(value)) return new Set(Array.from(iterated(value), (one) => plainData(one, seen, adapt)));

    // Anything of a class of its own is not ours to flatten: a Response, a URL,
    // a Date, a Map, a Promise: Python may hand any of those straight back to
    // JavaScript, and copying their keys would destroy them.
    if (!plainObject(value)) return value;

    // A class instance keeps its attributes under a private symbol rather than as
    // JavaScript properties, so walking its own keys finds almost nothing and
    // wanders into the class object instead. Its `__dict__` is what a reader
    // wants, and it is what JavaScript itself would serialise from a class
    // instance: the fields, not the getters on the prototype.
    //
    // And a class declaring `__slots__` keeps them somewhere else again: each
    // slot is read through its descriptor (`slotValues`) under its own name,
    // so adding `__slots__` to a model changes nothing of what crosses.
    //
    // Both sources and not one: `__slots__` may name `__dict__`, and then an
    // instance has slots *and* a dict. A dict of the author's is stepped over,
    // since `{"slot_value_x": 1}` is data and not storage.
    const attributes = ownAttributes(value);
    const holder = attributes !== null && typeof attributes === 'object' ? attributes : undefined;
    const slots = slotValues(value);

    // A mapping is its entries, whatever else it also is.
    //
    // `class Mapping(dict): pass` gets an instance `__dict__` beside its items,
    // and `Mapping({"answer": 42})` crosses as its items, not as its attributes.
    //
    // Entries only, which is the rule CPython's own `json` follows for a dict
    // subclass: an attribute on the instance describes the mapping and is not an
    // entry of it, and merging the two would invent keys the mapping does not
    // have.
    const mapping = globalThis.__BRYTHON__.is_dict(value);
    const type = ownType(value);

    if (authoredInstance(value)) {
        const fields = shell ?? {};

        if (holder !== undefined) {
            for (const key of Object.keys(holder)) {
                define(fields, key, plainData(holder[key], seen, adapt));
            }
        }

        // Under the name the author wrote, which is what the same class without
        // `__slots__` hands over.
        for (const [key, one] of slots) {
            define(fields, key, plainData(one, seen, adapt));
        }

        return fields;
    }

    // Asked of Python, through `pyEntries`, which walks the hash table as well as
    // the properties: a dict keeps only its string keys as properties, and
    // `{1: "janvier", 2: "février"}`, what anyone writes for a lookup table,
    // crosses whole, through `to_js`, through `tojson`, and through every Python
    // function's return value.
    //
    // The walk touches two symbols: `$B.is_dict` reads `Symbol(OB_TYPE)`, and
    // the iteration reads `ob_type` besides. A proxy that records every key
    // read, as SvelteKit's `event.params` is, is snapshot by `pyDict` at the
    // *inbound* boundary, so Python holds a plain dict and this function never
    // meets the proxy.
    //
    // The key crosses through the converter too: a JavaScript property name is a
    // string, and a Brython float is an object, so `{1.5: "x"}` would otherwise
    // be keyed by `[object Object]`.
    //
    // A set has no key to copy: `list(mon_set)` is the Python way to hand one
    // over, and it is what any serialiser would want anyway.
    //
    // And the floor under the two arms above, for the serialiser alone: a Python
    // value that is **not** a mapping and keeps nothing of the author's has no
    // representation here, and walking its properties would read the engine's.
    // CPython refuses the same values: *Object of type range is not JSON
    // serializable*.
    //
    // A question rather than a list of type names. `set` and `bytes` keep their
    // own arms because their sentences name the way out; this one names the
    // class.
    if (adapt !== undefined && seen instanceof Set && !mapping && pyClass(type)) {
        return adapt(value);
    }

    const out = shell ?? {};

    // A row as the rule in force reads it: the serialiser's is `json.dumps`'s, a
    // tuple of two; a copy for JavaScript reads it as `for key, one in
    // value.items()` does, and a pair written as a list is a pair.
    for (const [key, one] of pyItems(value, seen instanceof Set ? tuplePair : unpackedPair)) {
        define(out, propertyName(key, out, seen, adapt), plainData(one, seen, adapt));
    }

    return out;
}

// The name a Python key takes as a JavaScript property, and the refusal that
// belongs with it.
//
// Three sites write a mapping out, this converter, the export branch that
// adapts a dict holding a function, and a spread, and all ask here: a key
// handed to `define` and coerced by JavaScript would fold `{1: "numeric", "1":
// "text"}` into a single `"1"` key, whichever of the two comes first.
//
// A symbol is a property key of its own and stays one: written as its
// description, two symbols of one name became one key, and the copy no longer
// held the key the dict was asked by. JSON has no notation for one, and under
// the serialiser's rule it is refused as a symbol value is, where
// `JSON.stringify` would drop it in silence.
// The name alone, for a reader that looks a key up rather than writing a
// mapping out: a JavaScript property name is a string, and a Brython float is an
// object, so `{1.5: "x"}` would otherwise be keyed by `[object Object]`. A key
// `None` is spelled `"null"`, as JSON spells it: a name, not a value crossing.
export const propertyKey = (key) => (typeof key === 'symbol' ? key : String(key === NONE ? null : plainData(key)));

export function propertyName(key, out, seen, adapt) {
    if (typeof key === 'symbol' && adapt !== undefined && seen instanceof Set) adapt(key);

    const name = propertyKey(key);

    if (Object.hasOwn(out, name)) twoKeys(name);

    return name;
}

// A refusal: an error with its own sentence, signed where it is made with the
// name the host gave (`host.name`), so the author reads one name by whatever
// path it reaches them, a Python `except` included, and known as one by
// `refused` alone, so that whoever catches it can tell it from a JavaScript
// error and complete it with what only the caller knows, and a JavaScript
// error keeps crossing untouched. Nothing is written on the error.
const REFUSALS = new WeakSet();

export function refusal(message) {
    const error = new Error(`${host.name} — ${message}`);

    REFUSALS.add(error);

    return error;
}

export const refused = (error) => REFUSALS.has(error);

// Two keys Python keeps apart that JavaScript can only spell one way. The
// narrowing is the destination's, but the silence would be ours: a serialiser
// meeting something it cannot serialise owes the author a sentence.
export function twoKeys(name) {
    throw refusal(
        `this dict has two keys JavaScript cannot tell apart: ` +
            `\`${String(name)}\` is what both of them spell as a property name. A ` +
            `JavaScript object has string keys only, so one would silently ` +
            `replace the other on the way out.`
    );
}

// And the doors themselves: each named where it is opened, `toJs(value,
// 'spread')`, and its rule registered once, by the crossing for its own and by
// the host for the ones it opens (`doors`). What crosses by a door is found
// here, under its name, whichever site opened it.
const OUT = new Map();
const IN = new Map();

export const doors = {
    out(name, rule) {
        OUT.set(name, rule);
    },
    in(name, rule) {
        IN.set(name, rule);
    }
};

// A door taking more than the value (in Svelthon, a snippet's owners or a
// child's component) is handed the rest after it.
export const toJs = (value, name, ...rest) => OUT.get(name)(value, ...rest);
export const toPython = (value, name, ...rest) => IN.get(name)(value, ...rest);

// The crossing's own doors: a binding's value and a copy coming in, a value
// written into a view, and a copy and a scalar going out.
doors.in('binding', pyBind);
doors.in('copy', pyData);
doors.in('view-write', entering);
doors.out('copy', plainData);
doors.out('scalar', plainScalar);
