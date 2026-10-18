// The protocols of Python a host's syntax asks: a key equal values share, as
// `{#key}` and a keyed block take one, what `**` and a starred name take of a
// value, and a key looked up by `__getitem__`. Moved out of the host as they
// were; the host reaches them through `bryntime.js`.
import * as core from './core.js';
import * as mutations from './mutations.js';

const { NONE, _b_, boundMethod, callable, declares, jsMember, ownType, propertyKey, pyEntries, pyScalar, quietPyType, wrapperMethod } = core;
const { MISSING } = mutations;

// The items of an array read by index into a plain array, each through `fn`, as
// Svelte and Python read them: whatever the array holds as data, a `map`, a
// `constructor` or a species of its own, which the standard methods would ask
// for the copy they make.
export function byIndex(array, fn = (one) => one) {
    const out = [];

    for (let at = 0; at < array.length; at++) out.push(fn(array[at]));

    return out;
}

// The values a key compares by value: rebuilt on every computation, so `(1, 2)`
// is another object each time and only its repr() stays the same.
const BY_VALUE = [_b_.tuple, _b_.frozenset, _b_.float, _b_.complex, _b_.bytes];

// Whether a value's class defines its own equality, an `__eq__` or a `__hash__`
// other than those of the builtin it descends from. Its equality is then the
// author's code, and it keys by identity, as an instance of the author's does:
// a tuple's stored members say nothing of what such a class calls equal.
const ownEquality = (value) => {
    if (value === null || typeof value !== 'object') return false;

    const cls = quietPyType(value);
    const mro = cls?.tp_mro;

    if (!Array.isArray(mro)) return false;

    const base = mro.find((one) => one !== _b_.object && _b_[one.tp_name] === one);

    return (
        base !== undefined &&
        base !== cls &&
        (declares(cls, '__eq__') !== declares(base, '__eq__') || declares(cls, '__hash__') !== declares(base, '__hash__'))
    );
};

// The text two such values share exactly when Python finds them equal. A
// tuple or a frozenset is equal when its members are, so its text is built
// from theirs; anything else, an instance or a list, is equal to itself alone,
// as it is when it keys a row on its own, and so is a NaN, or a complex with a
// NaN part. A repr() the author
// wrote says nothing about equality: two instances may print alike.
const IDENTITIES = new WeakMap();
let identities = 0;
const identityOf = (value, name) => {
    let id = IDENTITIES.get(value);
    if (id === undefined) IDENTITIES.set(value, (id = `<${name} #${++identities}>`));
    return id;
};

// A number as Python compares it: `1 == 1.0 == True`, `0.0 == -0.0`,
// `complex(2, 0) == 2`, and a subclass of int, float or str equal to its value.
// So a value equal to a number is that number, as JavaScript holds it: an
// integral one exact, a Number up to 2 ** 53 and a BigInt past it, whichever
// it arrived as, and any other the double it is.
// Null for a value that is not one, and for a NaN, which equals nothing.
function numeric(value) {
    if (typeof value === 'boolean') return Number(value);
    if (typeof value === 'bigint') return Number.isSafeInteger(Number(value)) ? Number(value) : value;
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return null;
        return Number.isInteger(value) && !Number.isSafeInteger(value) ? BigInt(value) : value + 0;
    }

    const scalar = pyScalar(value);
    if (typeof scalar === 'number' || typeof scalar === 'bigint') return numeric(scalar);

    // A complex with no imaginary part is its real one.
    const mro = ownType(value)?.tp_mro;
    if (Array.isArray(mro) && mro.includes(_b_.complex) && value.imag?.value === 0) return numeric(value.real.value);

    return null;
}

const boundText = (self, operation) => {
    const object = self !== null && (typeof self === 'object' || typeof self === 'function');
    return `method(${object ? identityOf(self, 'self') : keyText(self)}, ${operation})`;
};

// A bound method is read anew each time, and two are equal when they bind the
// same object to the same operation: a method of the author's class, `{ob_type:
// method, im_self, im_func}`, a builtin's, a function carrying `m_self` and
// `ml`, or a special method read off a builtin, a `method_wrapper` (the one
// `declared` also reads). Its text, or null for a value that is not one.
function boundKey(value) {
    if (boundMethod(value)) return boundText(value.im_self, identityOf(value.im_func, 'function'));
    if (typeof value === 'function' && value.m_self !== undefined && value.ml?.ml_name !== undefined) {
        return boundText(value.m_self, value.ml.ml_name);
    }
    if (wrapperMethod(value)) return boundText(value.self, identityOf(value.wrapped.original ?? value.wrapped, 'function'));
    return null;
}

function keyText(value) {
    // None and the `undefined` it is at every door are one key, as `key` makes
    // them; `javascript.NULL`, which Python tells apart from None, is another,
    // spelled as Python prints it.
    if (value === undefined || value === NONE) return 'None';
    if (value === null) return _b_.repr(value);
    if (ownEquality(value)) return identityOf(value, quietPyType(value).tp_name);

    const number = numeric(value);
    if (number !== null) return String(number);

    if (typeof value === 'string') return _b_.repr(value);
    // A function is equal to itself alone, as an instance is: two built by one
    // factory print alike and are two keys. A bound method is equal by what it
    // binds (`boundKey`).
    const bound = boundKey(value);
    if (bound !== null) return bound;
    if (typeof value === 'function') return identityOf(value, 'function');
    // A symbol is equal to itself alone, whatever it prints: two made with one
    // description print alike and are two keys. Named by the hash the engine
    // gives it, which is its identity and outlives it no more than it must.
    if (typeof value === 'symbol') return `<symbol ${globalThis.__BRYTHON__.$hash(value)}>`;
    if (typeof value !== 'object') return String(value);

    const scalar = pyScalar(value);
    if (typeof scalar === 'string') return _b_.repr(scalar);

    const cls = globalThis.__BRYTHON__.get_class(value);
    const mro = cls.tp_mro;

    // The members equality compares are the stored ones, read here without an
    // `__iter__` a subclass redefines: that says what iterating yields, not
    // what the value is.
    if (mro.includes(_b_.tuple)) {
        const members = byIndex(value, keyText);
        return `(${members.join(', ')}${members.length === 1 ? ',' : ''})`;
    }
    if (mro.includes(_b_.frozenset)) {
        return `frozenset({${Object.values(value.$store).flat().map(keyText).sort().join(', ')}})`;
    }
    if (mro.includes(_b_.float) && Number.isNaN(value.value)) return identityOf(value, 'nan');
    // A complex compares its two parts, so a NaN in either makes it equal to
    // nothing but itself.
    if (mro.includes(_b_.complex) && (Number.isNaN(value.real.value) || Number.isNaN(value.imag.value))) {
        return identityOf(value, 'nan');
    }
    // And is equal to another when both parts are, as numbers: `-0.0` is `0.0`.
    if (mro.includes(_b_.complex)) return `complex(${numeric(value.real.value)}, ${numeric(value.imag.value)})`;

    // The builtin's repr(), which spells the value; a subclass's own `__repr__`
    // spells whatever its author chose, two values alike included.
    const builtin = BY_VALUE.find((one) => mro.includes(one));
    if (builtin !== undefined) {
        const $B = globalThis.__BRYTHON__;
        return $B.$call($B.$getattr(builtin, '__repr__'), value);
    }

    return identityOf(value, cls.__name__);
}

// One object per text, so such a key is stable across renders and never equal
// to a string the author keys with: `0.5` and `"0.5"` are two keys.
//
// Held weakly: a key needs to stay the same object only while something holds
// it, Svelte's block for one. Once it is collected, its entry goes too, so the
// cache holds what is rendered and not every key ever computed.
const KEYS = new Map();
const released = new FinalizationRegistry((repr) => {
    if (KEYS.get(repr)?.deref() === undefined) KEYS.delete(repr);
});
const keyFor = (repr) => {
    let key = KEYS.get(repr)?.deref();
    if (key === undefined) {
        key = Object.freeze({ toString: () => repr });
        KEYS.set(repr, new WeakRef(key));
        released.register(key, repr);
    }
    return key;
};

// A key Svelte compares with `===`, as `{#key}` and an `{#each}` take one. A
// list, a dict, a set or an instance is the same object while it lives, so it
// keys by identity: two equal rows are two rows, and a row mutated keeps its
// block. A value rebuilt each time keys by `keyText`, the text equal values
// share. A NaN, equal to nothing, gets a key object of its own, since the float
// itself would reach JavaScript as the number NaN, which no comparison finds
// again.
export function key(value) {
    // `None` is JavaScript's `undefined`, so `set_context(None, …)` and
    // `getContext(undefined)` name one entry, as every other door makes it.
    if (value === NONE) return undefined;
    if (ownEquality(value)) return value;

    // Equal to a number, it is that number, which is what an `int` key
    // already is: `1`, `1.0`, `True` and `Score(1.0)` are one key, as they
    // are one key of a dict. Equal to a string, it is that string.
    const number = numeric(value);
    if (number !== null) return number;

    // A bound method is rebuilt on every read, and equal by what it binds.
    const bound = boundKey(value);
    if (bound !== null) return keyFor(bound);

    if (value === null || typeof value !== 'object') return value;

    const text = pyScalar(value);
    if (typeof text === 'string') return text;

    try {
        const mro = globalThis.__BRYTHON__.get_class(value).tp_mro;
        if (!BY_VALUE.some((cls) => mro.includes(cls))) return value;

        return keyFor(keyText(value));
    } catch {
        return value; // a foreign JavaScript value keeps its own identity
    }
}

// `**rest` in a pattern read by key, `{#each rows as {id, **rest}}`: what the
// row holds beyond the keys the pattern took, a dict, for every row the fields
// themselves are read from, each row answering as its own language does.
//
// A JavaScript object is its own enumerable properties, its symbols included,
// which is what JavaScript's own `...rest` takes, and a key taken is compared
// as JavaScript compares a property's key: a symbol as itself, anything else as
// a string, so `{[year]: v, **rest}` with `year` the int `2024` leaves out the
// property "2024", as Svelte does.
//
// A Python value is its entries when it is a mapping, through `keys()` and
// `__getitem__`, which is what Python's own `{**row}` asks of one, and its
// attributes otherwise, what `vars(row)` holds: an instance of a class with
// `__slots__`, which has none, raises the TypeError `{**row}` raises rather
// than coming out empty.
//
// A mapping is a dict, or a row whose class declares `__getitem__` and whose
// `keys` answers with something callable, read as Python reads `row.keys`:
// once, its descriptor bound, so a classmethod or a property handing back a
// function counts as a method does. Of any other row `keys` is never read, and
// a field or a property of that name stays the row's data. A JavaScript
// object's `ob_type`, which the engine reads to tell its own objects, is read
// without running a getter (`quietPyType`), so each property is read once, by
// the copy, as JavaScript's own rest reads it.
export function restOf(row, taken) {
    const $B = globalThis.__BRYTHON__;
    const out = _b_.dict.$factory();

    if (javaScriptRow(row)) {
        const keys = new Set(Array.from(taken, (key) => propertyKey(key)));

        for (const key of Reflect.ownKeys(row)) {
            if (keys.has(key) || !Object.prototype.propertyIsEnumerable.call(row, key)) continue;

            $B.$setitem(out, key, jsMember(row, key));
        }

        return out;
    }

    for (const [key, value] of starredEntries(row)) {
        if (!$B.$is_member(key, taken)) $B.$setitem(out, key, value);
    }

    return out;
}

// Whether `**` reads a row as JavaScript's own `...` does: an object or a
// function the engine does not own. Anything else is a Python value, a str, an
// int, a bool and None among them, whose entries are `starredEntries`.
export const javaScriptRow = (row) =>
    row !== null && (typeof row === 'object' || typeof row === 'function') && quietPyType(row) === undefined;

// What `**` takes of a Python value in the markup, a rest or a spread alike: a
// mapping's entries, and otherwise an object's attributes, what `vars(value)`
// holds, where Python's own `{**value}` refuses. A value with neither is
// refused with the sentence `{**value}` raises, about the `**` the author
// wrote: None, a str, an int, an instance of a class with `__slots__`.
export const starredEntries = (value) => {
    const $B = globalThis.__BRYTHON__;
    const entries = mappingEntries(value);

    if (entries !== MISSING) return entries;

    const attributes = $B.get_dict(value);

    if (!attributes) {
        $B.RAISE(
            _b_.TypeError,
            `'${$B.class_name(value)}' object is not a mapping, and has no attributes for ** to take`
        );
    }

    return pyEntries(attributes);
};

// The entries of a Python mapping as Python's own `{**row}` reads them, or
// MISSING for a value that is no mapping: the one answer `**rest` and a spread
// both ask for.
//
// A dict that keeps the dict's own iteration is its items, whatever a `keys`
// written on it or on its class says, which is CPython's fast path. Any other
// mapping is `row.keys()`, then `row[key]`: `keys` read once, as Python reads
// `row.keys`, its descriptor bound, so a classmethod or a property handing back
// a function counts as a method does. Asked only of a class declaring
// `__getitem__`, so a field or a property called `keys` on any other object
// stays its data and is never run.
function mappingEntries(row) {
    const $B = globalThis.__BRYTHON__;
    const cls = quietPyType(row) ?? $B.get_class(row);

    if ($B.is_dict(row) && declares(cls, '__iter__') === declares(_b_.dict, '__iter__')) return pyEntries(row);
    if (declares(cls, '__getitem__') === $B.NULL) return MISSING;

    const keys = $B.$getattr(row, 'keys', MISSING);

    if (keys === MISSING || !callable(keys)) return MISSING;

    return $B.$call(_b_.list, $B.$call(keys)).map((key) => [key, $B.$getitem(row, key)]);
}

// `[first, *others, last]` in a pattern: the row unpacked as Python unpacks a
// starred target, by the engine's own unpacking, `before` names, the starred
// one, `after` names. The starred name is a list, and a row too short or not
// iterable raises what Python raises. What comes back is the values in order,
// which the block's brackets take apart.
export function unpackStarred(row, before, after) {
    const $B = globalThis.__BRYTHON__;
    const values = $B.unpacker(row, before + 1 + after, true, after);
    const out = [];

    for (let i = 0; i < before; i++) out.push(values.read_one());
    out.push(values.read_rest());
    for (let i = 0; i < after; i++) out.push(values.read_one());

    return $B.$list(out);
}

// Builtin sequences, whose `__getitem__` refuses a string key with a TypeError:
// for them that says "no such key", as a KeyError says it for a mapping.
const SEQUENCES = [_b_.list, _b_.tuple, _b_.str, _b_.bytes, _b_.range];

// The key `name` of `target`, or MISSING when there is none. An absence is what
// the protocol answers when nothing is there: no `__getitem__` at all, a
// `LookupError`, or a builtin sequence's `__getitem__`, inherited by a subclass
// or not, refusing a string. Anything else a `__getitem__` raises is its
// author's answer and goes on, both to a read and to the choice of where a
// write lands.
//
// Whether there is a `__getitem__` is asked the way `target[name]` asks it, of
// the dicts along the class's MRO: reading it as an attribute of the class runs
// the metaclass's `__getattribute__`, which an operator never consults.
export function lookup(target, name) {
    const $B = globalThis.__BRYTHON__;

    let cls;
    let getitem;
    try {
        cls = $B.get_class(target);
        getitem = $B.search_in_mro(cls, '__getitem__', $B.NULL);
        if (getitem === $B.NULL) return MISSING;
    } catch {
        return MISSING; // a foreign JavaScript value has no Python protocol to ask
    }

    try {
        return $B.$getitem(target, name);
    } catch (error) {
        let mro;
        try {
            mro = $B.get_class(error).tp_mro;
        } catch {
            return MISSING;
        }
        if (!Array.isArray(mro)) return MISSING;
        if (mro.includes(_b_.LookupError)) return MISSING;
        // The sequence's own `__getitem__` on one of its instances: borrowed by
        // another class, it refuses the receiver, which is no absence.
        const sequence = (one) => $B.search_in_mro(one, '__getitem__', $B.NULL) === getitem && cls.tp_mro.includes(one);

        if (mro.includes(_b_.TypeError) && SEQUENCES.some(sequence)) {
            return MISSING;
        }

        throw error;
    }
}
