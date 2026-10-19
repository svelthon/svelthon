// The views of Python containers JavaScript reads: a list read as an Array, a
// dict and an instance as objects, a set as a Set, live, and JavaScript's
// writes back into Python. Moved out of the runtime as it was; the host
// reaches it through `bryntime.js`.
import * as core from './core.js';
import * as mutations from './mutations.js';
import { pyError, relayed } from './errors.js';
import { ADAPTERS, declared, pyExport, pyHandler } from './calls.js';

const { LIST_VIEW, NONE, PLAIN_VIEW, VIEWED, VIEW_OF, _b_, authoredInstance, bytesOut, callable, crossedAs, declares, define, entering, isSet, iterated, lent, ownAttributes, ownType, plainData, plainScalar, propertyKey, pyAwaitable, pyBind, pyBytes, pyClass, pyEntries, pyScalar, pyType, quietPyType, refused, slotValues, twoKeys } = core;
const { MARKS, MISSING, PUBLISHED, follow, mark, removeFound } = mutations;

// The same rows, for a JavaScript walk of a view. What the class raises, or a
// protocol it breaks, crosses as everything Python raises under a view does
// (`relayed`).
function walkedRows(value) {
    try {
        return iterated(value);
    } catch (error) {
        throw pyError(error, `${ownType(value).tp_name}.__iter__()`);
    }
}

// A text signature that declares no positional parameter but the receiver:
// `($self, /, *, key=None, reverse=False)`, `list.sort`'s.
const NO_POSITIONAL = /^\(\$self(?:,\s*\/)?(?:,\s*\*\s*(?:,.*)?)?\)$/s;

// Whether a builtin bound to its receiver takes no positional argument but the
// receiver, which is all JavaScript can pass: `rows.clear`, which `list` lists
// in `noargs_methods`, the way CPython flags it `METH_NOARGS`, or `rows.sort`,
// whose `__text_signature__` has keywords only. For the list, the class of the
// MRO whose dictionary holds the name answers, so a subclass that rebinds the
// name answers for itself.
export const takesNoPositional = (value) => {
    const $B = globalThis.__BRYTHON__;

    if (typeof value.__text_signature__ === 'string' && NO_POSITIONAL.test(value.__text_signature__)) return true;

    const name = value.ml?.ml_name;
    // `"hello".upper` is bound to a JavaScript string, whose class no getter of
    // the author's can answer for.
    const self = value.m_self;
    const type = typeof self === 'object' ? pyType(self) : $B.get_class(self);

    if (typeof name !== 'string' || type === undefined) return false;

    for (const one of Array.isArray(type.tp_mro) ? type.tp_mro : [type]) {
        if ($B.search_in_dict(one, name, $B.NULL) !== $B.NULL) {
            return Object.hasOwn(one, 'noargs_methods') && one.noargs_methods.includes(name);
        }
    }

    return false;
};

// Whether a value's class has a hash, asked of the class as `hash()` asks it,
// with nothing of the value's run: a list's, a dict's, a set's, and a class's
// that sets `__hash__ = None` or defines `__eq__` alone, has none.
const hashable = (value) => {
    const $B = globalThis.__BRYTHON__;
    const slot = $B.search_slot($B.get_class(value), 'tp_hash', $B.NULL);

    return slot !== $B.NULL && slot !== _b_.None;
};

// Whether a set's class answers a protocol as `set` does, `__iter__` or
// `__contains__`: the one its ancestry finds first is the builtin's. A subclass
// that redefines it decides what it answers, what a walk yields, as a list's
// subclass does (`iterated`), or what is in it, whatever it is asked about.
const asSet = (value, name) => {
    const own = declares(ownType(value), name);

    return own === declares(_b_.set, name) || own === declares(_b_.frozenset, name);
};

// A view's own property, described. One whose read runs the author's code, a
// `__getitem__` or a `__getattribute__` of their class, is an accessor, as a
// getter is in JavaScript: listing the keys reads nothing, and a copy reads it
// once, through the view. Any other holds its value, read here, as Svelte's
// state describes its own.
const viewDescriptor = (view, key, authored, read) =>
    authored
        ? {
              get: () => view[key],
              set: (given) => {
                  view[key] = given;
              },
              enumerable: true,
              configurable: true
          }
        : { value: read(), writable: true, enumerable: true, configurable: true };

const forReader = (one) => {
    if (one === NONE) return undefined;

    // A coroutine read off a view is the promise it crosses as anywhere, one run
    // for every reference to it, its result crossing as a returned value does:
    // `{"slow": fetch_slowly()}` returned by a `load()` streams.
    if (pyAwaitable(one)) return crossedAs(one, forReader, (result) => pyExport(result));
    if (one !== null && (typeof one === 'object' || typeof one === 'function') && callable(one)) return pyHandler(one);

    const scalar = pyScalar(one);

    return scalar === undefined ? viewOf(one) : scalar;
};

const INDEX = /^(?:0|[1-9]\d*)$/;

// The counter Brython keeps on a dict and moves at each insertion and deletion
// of a key, a symbol of its own (`py_dict.js`), found once by its description:
// a table built from the keys holds until it moves. Not found, every read
// builds the table again, which is slow and right.
let DICT_VERSION;
const dictVersion = () =>
    (DICT_VERSION ??=
        Object.getOwnPropertySymbols(globalThis.__BRYTHON__.empty_dict()).find((one) => one.description === 'VERSION') ??
        Symbol('bryntime.noVersion'));

// The array a dict holding a key that is not a string keeps its keys in, in the
// order they entered (`py_dict.js`): a deletion leaves a hole and an insertion
// always goes at the end, so a key that left and came back is at another
// place, and `clear` drops the array. Found once by its description, as the
// counter above, on a dict made to hold one such key.
let DICT_KEYS;
const dictKeys = () => {
    if (DICT_KEYS === undefined) {
        const $B = globalThis.__BRYTHON__;
        const probe = $B.empty_dict();

        $B.$setitem(probe, 0, 0);
        DICT_KEYS = Object.getOwnPropertySymbols(probe).find((one) => one.description === 'KEYS') ?? Symbol('bryntime.noKeys');
    }

    return DICT_KEYS;
};

// The names a dict view gave the keys at each place of a dict's array of keys,
// by the array: what a place holds never changes, so its name is taken once,
// and a dropped array takes its names with it.
const PLACE_NAMES = new WeakMap();

// Where a dict view's table records a name two keys share.
const TWO_KEYS = Symbol('bryntime.twoKeys');

export function viewOf(value) {
    const $B = globalThis.__BRYTHON__;

    if (value === null || typeof value !== 'object') return value;

    const known = VIEW_OF.get(value);

    if (known !== undefined) return known;

    const sequence = Boolean($B.is_list(value) || $B.is_tuple(value));

    if (!sequence && !$B.is_dict(value)) {
        if (isSet(value)) return setView(value);
        if (pyBytes(value)) return bytesOut(value);

        return authoredInstance(value) ? instanceView(value) : value;
    }

    const length = () => $B.builtins.len(value);
    // An array index is one below 2³² − 1; a larger number is an ordinary
    // property to an array, which a list does not hold.
    const index = (key) => {
        const at = typeof key === 'string' && INDEX.test(key) ? Number(key) : undefined;

        return at < 2 ** 32 - 1 ? at : undefined;
    };
    // A dict's keys under the names the copy gives them (`propertyKey`), so a
    // reader sees the entries `to_js` writes: `{7: 42}` is `{"7": 42}`, where it
    // was `{}` and a child handed the dict read nothing. The key itself when it
    // is the name, the one lookup most reads make; a key of another type only
    // when the dict holds one, found by its name in a table built once per
    // version of the dict, so reading the whole view is linear in its size, as
    // copying it is. Two keys of one name are refused at any read of it, as the
    // copy refuses them.
    //
    // Each key named once, by the place it takes in the dict's array of keys
    // (`dictKeys`), and read so by every operation, the walk, a read and a
    // write alike: as JavaScript names an object key when it is written, `o[k]
    // = 42`, and keeps that name whatever `k`'s `toString` answers later. A key
    // that leaves and comes back takes another place, and is named then, as
    // writing it again names it again; a key that stays keeps its place and
    // its name, whoever read the dict in between. The one name the view cannot
    // have is the one a key answered before the view first looked: Python
    // writes a key without asking its name.
    //
    // The table holds places and not keys, and the names are kept by the array
    // (`PLACE_NAMES`), so a key gone from the dict is not the view's to hold.
    // Taken afresh at some reads and not others, a name moved under a reader
    // that had just listed it and each read paid the whole table; taken afresh
    // at each change, an unrelated key added made the whole view refuse to be
    // read; kept by key, a key's name depended on who had read the dict while
    // it was out.
    let named = null;
    let namedAt;

    const placeNames = (places) => {
        let names = PLACE_NAMES.get(places);

        if (names === undefined) PLACE_NAMES.set(places, (names = new Map()));

        return names;
    };
    const nameAt = (places, names, at) => {
        if (!names.has(at)) names.set(at, propertyKey(places[at]));

        return names.get(at);
    };

    const nonStringKeys = () => {
        const at = value[dictVersion()];

        if (named === null || at === undefined || at !== namedAt) {
            const places = value[dictKeys()];

            named = new Map();
            if (places !== undefined) {
                const names = placeNames(places);

                for (let place = 0; place < places.length; place++) {
                    const key = places[place];

                    if (key === undefined || typeof key === 'string') continue;

                    const name = nameAt(places, names, place);

                    named.set(name, named.has(name) ? TWO_KEYS : place);
                }
            }
            namedAt = at;
        }

        return named;
    };
    // Found in the dict's storage (`dict.$contains`), which a read, a write and
    // a deletion need, and never by its class's `__contains__`, which Python's
    // `bag["x"]`, `bag["x"] = v` and `del bag["x"]` do not ask: asked, a class
    // whose `in` answers otherwise read as empty, kept a key deleted, or
    // raised. JavaScript's `in` is Python's, and asks it (`asked`).
    const keyFor = (name, asked = false) => {
        const own =
            (typeof name === 'string' || typeof name === 'symbol') &&
            (asked ? $B.$is_member(name, value) : _b_.dict.$contains(value, name));

        if (typeof name !== 'string' || $B.hasOnlyStringKeys(value)) return own ? name : MISSING;

        const other = nonStringKeys().get(name);

        if (other === TWO_KEYS || (own && other !== undefined)) twoKeys(name);

        return own ? name : other === undefined ? MISSING : value[dictKeys()][other];
    };
    const holds = (key, asked = false) => {
        if (sequence) {
            const at = index(key);

            return at !== undefined && at < length();
        }

        return keyFor(key, asked) !== MISSING;
    };
    const read = (key) => forReader($B.$getitem(value, sequence ? index(key) : keyFor(key)));
    // Whether a read is the author's: a subclass's own `__getitem__`.
    const base = sequence ? ($B.is_list(value) ? _b_.list : _b_.tuple) : _b_.dict;
    const authored = () => declares(quietPyType(value), '__getitem__') !== declares(base, '__getitem__');

    // Every name, as the copy writes them and from the table a read finds them
    // in: two keys of one name, `7` and `"7"`, are refused as the copy refuses
    // them, where the view showed one and dropped the other.
    const keys = () => {
        if (sequence) return Array.from({ length: length() }, (_, at) => String(at));

        const names = {};
        const places = value[dictKeys()];
        const add = (name) => {
            if (Object.hasOwn(names, name)) twoKeys(name);
            define(names, name, true);
        };

        if (places === undefined) {
            for (const [key] of pyEntries(value)) add(propertyKey(key));
        } else {
            const given = placeNames(places);

            for (let place = 0; place < places.length; place++) {
                const key = places[place];

                if (key !== undefined) add(typeof key === 'string' ? key : nameAt(places, given, place));
            }
        }

        return Reflect.ownKeys(names);
    };

    // A length or an index past the end, written as Python writes it, each in
    // one call: `del rows[wanted:]`, `rows.extend([None] * missing)`, then
    // `rows[at] = given`. A subclass whose `pop` or `append` does not move the
    // length ends the write all the same.
    const pad = (to) => {
        if (length() < to) $B.$call($B.$getattr(value, 'extend'), _b_.list.$factory(Array(to - length()).fill(NONE)));
    };

    const write = (key, given) => {
        if (!sequence) {
            const held = keyFor(key);

            return $B.$setitem(value, held === MISSING ? key : held, entering(given)), true;
        }
        if (!$B.is_list(value)) return false;

        if (key === 'length') {
            // An array's own rule, applied by an array before the first element
            // goes: a length is a whole number below 2³², `-1`, `1.5` or `NaN`
            // a RangeError and `1n` a TypeError, the value converted twice as
            // the engine converts it. An empty array holds none of it.
            const probe = [];

            probe.length = given;

            const wanted = probe.length;

            if (length() > wanted) $B.$call($B.$getattr(value, '__delitem__'), _b_.slice.$factory(wanted, NONE));
            else pad(wanted);

            return true;
        }

        const at = index(key);

        if (at === undefined) return false;

        pad(at + 1);
        $B.$setitem(value, at, entering(given));

        return true;
    };

    // A JavaScript `delete` leaves a hole where an array had an element, the
    // last one included, and the length as it was: `pop` and `splice` shorten
    // the array by writing its `length` afterwards.
    const remove = (key) => {
        if (!holds(key)) return true;
        if (!sequence) return $B.$call($B.$getattr(value, '__delitem__'), keyFor(key)), true;
        if (!$B.is_list(value)) return false;

        $B.$setitem(value, index(key), NONE);

        return true;
    };

    // The keys a write may name, the ones a read finds: a dict's strings and
    // symbols, a symbol being a Python key as itself, and a list's indices.
    const writable = (key) => typeof key === 'string' || (!sequence && typeof key === 'symbol');

    // A walk of a sequence is Python's walk, its class's `__iter__`, as the
    // loop and `tojson` take it, where an index is Python's index: a subclass
    // whose `__iter__` reverses its rows is `[3, 2, 1]` to `[...rows]` and
    // `rows[0]` is still 1, as in Python.
    function* walk() {
        for (const one of walkedRows(value)) yield forReader(one);
    }

    const view = new Proxy(sequence ? [] : Object.create(PLAIN_VIEW), relayed({
        getPrototypeOf(shell) {
            return sequence ? LIST_VIEW : Object.getPrototypeOf(shell);
        },
        get(shell, key, receiver) {
            follow(value);

            if (sequence && key === 'length') return length();
            if (sequence && key === Symbol.iterator) return walk;

            return holds(key) ? read(key) : Reflect.get(shell, key, receiver);
        },
        has(shell, key) {
            follow(value);

            return holds(key, true) || Reflect.has(shell, key);
        },
        ownKeys(shell) {
            follow(value);

            return sequence ? [...keys(), 'length'] : keys();
        },
        getOwnPropertyDescriptor(shell, key) {
            follow(value);

            if (sequence && key === 'length') {
                return { value: length(), writable: true, enumerable: false, configurable: false };
            }

            return holds(key) ? viewDescriptor(view, key, authored(), () => read(key)) : undefined;
        },
        set(shell, key, given) {
            return writable(key) && write(key, given);
        },
        // Svelte's rule for its own state, checked before anything is written: a
        // view holds values, so a descriptor carries one and leaves the
        // property writable, enumerable and configurable.
        defineProperty(shell, key, descriptor) {
            if (
                !('value' in descriptor) ||
                descriptor.configurable === false ||
                descriptor.enumerable === false ||
                descriptor.writable === false
            ) {
                throw new TypeError(
                    'Property descriptors defined on a Python view must contain `value` and always be `enumerable`, `configurable` and `writable`'
                );
            }

            return writable(key) && write(key, descriptor.value);
        },
        deleteProperty(shell, key) {
            return writable(key) && remove(key);
        },
        // The keys are the container's, which Python may still add to, and a
        // shell that refused new ones could no longer announce them: refused,
        // as `Reflect.preventExtensions` answers a refusal, before the shell is
        // locked.
        preventExtensions() {
            return false;
        },
        // The prototype is the view's shape, a list's methods among it, and
        // Svelte's state refuses the same request.
        setPrototypeOf() {
            throw new TypeError('Cannot set the prototype of a Python view');
        }
    }, $B.class_name(value)));

    VIEW_OF.set(value, view);
    VIEWED.add(view);
    $B.PYOBJ_MAP.set(view, value);

    return view;
}

// An instance of the author's class, read through a view as a list or a dict
// is. A field is its attribute, read by Python's attribute protocol at every
// read, so a property runs and a method arrives as a function JavaScript can
// call; a write is Python's `setattr` and a `delete` its `delattr`, which notify
// as the same line written in Python does. Its own keys are its attributes, the
// ones `vars()` and its slots hold, as the copy writes them. Handed over raw, a
// JavaScript reader found none of them: Brython keeps them under a symbol. Its
// prototype is a dict view's (`PLAIN_VIEW`).

function instanceView(value) {
    const $B = globalThis.__BRYTHON__;
    const attribute = (key) => (typeof key === 'string' ? $B.$getattr(value, key, MISSING) : MISSING);
    const slots = () => [...slotValues(value).keys()];
    const fields = () => {
        const attributes = ownAttributes(value);
        const own = attributes !== null && typeof attributes === 'object' ? Object.keys(attributes) : [];

        return [...new Set([...own, ...slots()])];
    };
    const owns = (key) => {
        if (typeof key !== 'string') return false;

        const attributes = ownAttributes(value);

        return (
            (attributes !== null && typeof attributes === 'object' && Object.hasOwn(attributes, key)) ||
            slotValues(value, false, key).has(key)
        );
    };
    // Whether the class holds the name as a descriptor that deletes, a
    // `property` or the author's own with `__delete__`, which `del box.value`
    // runs: read off the class dictionaries, nothing of the author's run.
    const deletes = (key) => {
        if (typeof key !== 'string') return false;

        const held = declares(quietPyType(value), key);
        const kind = held === $B.NULL ? undefined : quietPyType(held);

        return kind !== undefined && declares(kind, '__delete__') !== $B.NULL;
    };
    const write = (key, given) => typeof key === 'string' && ($B.$setattr(value, key, entering(given)), true);
    // Whether a read is the author's: a `__getattribute__` of their class.
    const authored = () => declares(quietPyType(value), '__getattribute__') !== declares(_b_.object, '__getattribute__');

    // How the instance prints, when its class says: a `__str__` or a `__repr__`
    // on it or on a base other than `object` is its `toString`, as a JavaScript
    // class that defines one prints by it, in a template and in a `${}`. A class
    // that says nothing prints as an object, as theirs does.
    const prints = () => {
        const type = ownType(value);

        return (Array.isArray(type.tp_mro) ? type.tp_mro : [type]).some(
            (one) => one !== _b_.object && ['__str__', '__repr__'].some((name) => $B.search_in_dict(one, name, $B.NULL) !== $B.NULL)
        );
    };
    // Called after the trap that handed it out has returned, so it relays what
    // `str()` raises itself, as the traps do (`relayed`).
    const printed = () => {
        try {
            return String($B.builtins.str.$factory(value));
        } catch (error) {
            throw pyError(error, `${$B.class_name(value)}.__str__()`);
        }
    };

    const view = new Proxy(Object.create(PLAIN_VIEW), relayed({
        get(shell, key, receiver) {
            follow(value);

            const found = attribute(key);

            if (found === MISSING && key === 'toString' && prints()) return printed;

            return found === MISSING ? Reflect.get(shell, key, receiver) : forReader(found);
        },
        // Whether the attribute is there, asked without reading it, as `in`
        // asks of a JavaScript object: a property is not run, nor a getter
        // that raises (`attributed`).
        has(shell, key) {
            follow(value);

            return (typeof key === 'string' && attributed(value, key)) || Reflect.has(shell, key);
        },
        ownKeys() {
            follow(value);

            return fields();
        },
        getOwnPropertyDescriptor(shell, key) {
            follow(value);

            return owns(key) ? viewDescriptor(view, key, authored(), () => forReader(attribute(key))) : undefined;
        },
        set(shell, key, given) {
            return write(key, given);
        },
        // Svelte's rule for its own state, as the other views keep it.
        defineProperty(shell, key, descriptor) {
            if (
                !('value' in descriptor) ||
                descriptor.configurable === false ||
                descriptor.enumerable === false ||
                descriptor.writable === false
            ) {
                throw new TypeError(
                    'Property descriptors defined on a Python view must contain `value` and always be `enumerable`, `configurable` and `writable`'
                );
            }

            return write(key, descriptor.value);
        },
        // Python's `delattr` for an attribute of the instance's own and for
        // one its class keeps behind a deleter, which runs, and raises what
        // it raises; a name of the class's alone, or none, is left as
        // JavaScript leaves a property it does not own.
        deleteProperty(shell, key) {
            if (owns(key) || deletes(key)) $B.$delattr(value, key);

            return true;
        },
        preventExtensions() {
            return false;
        },
        setPrototypeOf() {
            throw new TypeError('Cannot set the prototype of a Python view');
        }
    }, $B.class_name(value)));

    VIEW_OF.set(value, view);
    VIEWED.add(view);
    $B.PYOBJ_MAP.set(view, value);

    return view;
}

// A set or a frozenset, read by JavaScript as a `Set`, which is how JavaScript
// holds one: a subclass of `Set`, as Svelte's own `SvelteSet` is, so
// `instanceof Set` holds, whose every method asks the Python set at the call.
// A proxy alone cannot stand in for a `Set`, whose methods refuse a receiver
// without the set's own storage, which is why this view is a class.
//
// A member reads as a list's does (`forReader`), a value looked up or added
// crosses as a write into a view does, and a write is Python's `add`,
// `discard` or `clear`, which notify. A frozenset has none of the three, and a
// write refuses with a JavaScript `TypeError`, as a write to a tuple's view
// does, in Python's words. Anything else Python raises reaches the caller as
// under every view (`relayed`).
//
// The calls that only add to a set, which no walk has to look into: what one
// of them removes, in a class that redefines it, goes through a call of its own.
const ARRIVING = new Set(['add', 'update', '__ior__']);

// The calls that only take members away, which no walk has to read again for
// a member they may have added: a member put back after them arrives by an
// `add` of its own, in its turn.
const REMOVING = new Set(['discard', 'remove', 'pop', 'clear']);

// The classes whose hash runs nothing of the author's, beside an object hashed
// by its identity: a walk may ask them for the bucket a member is filed under.
// A JavaScript object is hashed by its identity too, through a slot of its own.
const BUILTIN_HASHED = [_b_.int, _b_.float, _b_.str, _b_.bool, globalThis.__BRYTHON__.JSObj];

// Whether two values are one member of a JavaScript `Set` (SameValueZero): a
// number or a string of Python's, a subclass's among them, as the scalar it
// crosses as (`pyScalar`), which is what a reader of the view was handed, and
// anything else as itself. Nothing of the author's runs.
const sameMember = (a, b) => {
    const [x, y] = [pyScalar(a) ?? a, pyScalar(b) ?? b];

    return x === y || (x !== x && y !== y);
};

class SetView extends Set {
    #value;

    constructor(value) {
        super();
        this.#value = value;
    }

    #call(name, ...args) {
        const $B = globalThis.__BRYTHON__;
        const type = ownType(this.#value);

        if (declares(type, name) === $B.NULL) {
            throw new TypeError(`'${type.tp_name}' object has no attribute '${name}'`);
        }

        try {
            return $B.$call($B.$getattr(this.#value, name), ...args);
        } catch (error) {
            throw pyError(error, `${type.tp_name}.${name}()`);
        }
    }

    // The public members call private ones, which the other methods call too:
    // a `has`, a `values` or a `size` JavaScript puts on the view is the
    // view's, as on a `Set`, whose methods read its storage and not them.
    get size() {
        return this.#size;
    }

    has(one) {
        return this.#has(one);
    }

    values() {
        return this.#members();
    }

    get #size() {
        follow(this.#value);

        try {
            return globalThis.__BRYTHON__.builtins.len(this.#value);
        } catch (error) {
            throw pyError(error, `${ownType(this.#value).tp_name}.__len__()`);
        }
    }

    #has(one) {
        const $B = globalThis.__BRYTHON__;
        const bound = pyBind(one);

        follow(this.#value);

        // JavaScript's `has` answers any value, where `set`'s `in` refuses one
        // whose class has no hash: that refusal is a no, told by the class
        // before anything runs. A set is asked as Python asks it, as the
        // frozenset of its members. A class that redefines `__contains__` is
        // asked whatever the value, a row it reads a key from among them.
        // Anything the set raises reaches the caller, a `TypeError` of its
        // `__contains__` as much as any other.
        if (asSet(this.#value, '__contains__') && !isSet(bound) && !hashable(bound)) return false;

        try {
            return Boolean($B.$is_member(bound, this.#value));
        } catch (error) {
            throw pyError(error, `${ownType(this.#value).tp_name}.__contains__()`);
        }
    }

    // The set a method hands back, `add`'s result and `forEach`'s third
    // argument, is the view JavaScript was given and not this object, whose
    // own storage is empty: cloned, it would be an empty set, given in silence.
    get #published() {
        return PUBLISHED_SETS.get(this) ?? this;
    }

    add(one) {
        this.#call('add', entering(one));

        return this.#published;
    }

    // Python's `discard`, and whether the member asked for went, never by
    // asking the set again. Asked first whether it held the member, the view
    // hashed it a second time, and a class whose `in` answers otherwise kept
    // it. JavaScript's `delete` answers any value, where a set's own `discard`
    // refuses one whose class has no hash: told by the class, before anything
    // runs. A frozenset has no `discard`, and refuses the write.
    //
    // A set's own `discard` is looked up here, as the engine's lookup does it
    // (`set_lookkey`): the member hashed once, a set as the frozenset of its
    // members, then each member filed under that hash, in turn, until one is
    // it or equal to it. The answer is the lookup's, decided where it finds the
    // member: whatever the author's `__hash__` or `__eq__` adds or removes in
    // passing, and whatever it raises, is theirs, as in Python's `discard`.
    // The member found is taken out and told as `discard` takes it out and
    // tells it (`removeFound`).
    //
    // The set's own `discard` is the one Python reads off it, `bag.discard`:
    // its class declares the builtin's, reads its names the builtin way, with
    // no `__getattribute__` of the author's, and the object holds no `discard`
    // of its own, which an instance's dict would give before the class's.
    //
    // Any other `discard` decides what it removes, and only it knows what the
    // value asked for names: the view calls it as Python reads it, asks it
    // nothing more, and answers as a JavaScript `Set` would, whether the value
    // itself went (`sameMember`), running nothing of the author's.
    delete(one) {
        const $B = globalThis.__BRYTHON__;
        const bound = pyBind(one);
        const value = this.#value;
        const type = ownType(value);
        const attributes = ownAttributes(value);
        const own =
            declares(type, 'discard') === declares(_b_.set, 'discard') &&
            declares(type, '__getattribute__') === declares(_b_.set, '__getattribute__') &&
            !($B.is_dict(attributes) && _b_.dict.$contains(attributes, 'discard'));

        if (own) {
            if (!isSet(bound) && !hashable(bound)) return false;

            try {
                let hash;

                try {
                    hash = $B.hash_for(bound, 'a set element');
                } catch (error) {
                    if (quietPyType(bound)?.tp_mro.includes(_b_.set) !== true) throw error;
                    hash = $B.$hash(_b_.frozenset.$factory(bound));
                }

                const filed = value.$store[hash] ?? [];

                for (let at = 0, size = filed.length; at < size; at++) {
                    if ($B.is_or_equals(bound, filed[at])) {
                        removeFound(value, hash, at, bound);
                        return true;
                    }
                }
            } catch (error) {
                throw pyError(error, `${type.tp_name}.discard()`);
            }

            return false;
        }

        const held = Object.values(value.$store).flat();

        this.#call('discard', bound);

        const left = new Set(Object.values(value.$store).flat());

        return held.some((member) => !left.has(member) && sameMember(member, bound));
    }

    clear() {
        this.#call('clear');
    }

    // A walk is the class's own: a subclass that redefines `__iter__` is walked
    // by it, as a list's view is, its rows as the walk begins and what it
    // raises reaching the caller as a write's refusal does.
    //
    // Any other walk is live as a `Set`'s is: a member deleted before its turn
    // is not visited, one that arrives during the walk is, after the others,
    // one deleted and added back is visited again, and `clear` ends it.
    //
    // A member's place says nothing of its history: a set keeps its members in
    // buckets by hash (`$store`), a member put back may land where it was, and
    // `intersection_update` rebuilds the buckets of members that never left.
    // So the walk learns each departure as it happens, from the set's marker,
    // which every call that changes the set goes through, whichever language
    // made it: the set comes under watch for that, and the walk signs on for
    // as long as it lasts. A member visited is due again once it has left, and
    // the walk forgets it then, so it holds no member the set let go.
    //
    // Each change costs what it touches: a single removal asks only the members
    // visited under its hash, a member added waits in a queue for its turn, and
    // only a change of many, or of a value whose hash would run the author's
    // code, reads the set again. Asked of every member, a walk that deleted the
    // members it had not reached, or that added one at each step, as a worklist
    // does, grew with the square of its length.
    *#members() {
        const value = this.#value;

        follow(value);

        if (!asSet(value, '__iter__')) {
            for (const one of walkedRows(value)) yield forReader(one);

            return;
        }

        const $B = globalThis.__BRYTHON__;
        const present = (one, hash) => value.$store[hash]?.includes(one) === true;
        // What the set holds for a member: the member itself, or one equal to
        // it, Python keeping one member per value. `intersection_update` may
        // keep the other set's object for it, a float rebuilt where `0.5`
        // stayed. An `__eq__` that raises tells nothing here: the set's own
        // call has already answered.
        const kept = (one, hash) => {
            const bucket = value.$store[hash];

            if (bucket === undefined) return MISSING;
            if (bucket.includes(one)) return one;

            for (const other of bucket) {
                try {
                    if ($B.is_or_equals(other, one)) return other;
                } catch {
                    /* not this one */
                }
            }

            return MISSING;
        };
        // Whether hashing a value runs nothing of the author's: a number, a
        // string, a bool, a builtin int, float or str, an object hashed by its
        // identity, a frozenset, whose hash is made of the hashes its members
        // are filed under, or a tuple of such values, whose hash hashes them.
        const quiet = (one) => {
            const kind = typeof one;

            if (kind === 'number' || kind === 'string' || kind === 'boolean' || kind === 'bigint') return true;

            const type = $B.get_class(one);
            const slot = $B.search_slot(type, 'tp_hash', $B.NULL);
            const builtin = (cls) => slot === $B.search_slot(cls, 'tp_hash', $B.NULL);

            if (BUILTIN_HASHED.includes(type) || builtin(_b_.object) || builtin(_b_.frozenset)) return true;

            return builtin(_b_.tuple) && one.every(quiet);
        };
        // The hash a value is filed under, when hashing it runs nothing of the
        // author's. Undefined for anything else.
        const filed = (one) => {
            try {
                return quiet(one) ? String($B.$hash(one)) : undefined;
            } catch {
                return undefined;
            }
        };
        // Members by the hash they are filed under, and the members under each
        // hash: those visited, and those due, not reached yet.
        const ledger = () => ({
            at: new Map(),
            under: new Map(),
            add(one, hash) {
                this.at.set(one, hash);
                if (!this.under.has(hash)) this.under.set(hash, new Set());
                this.under.get(hash).add(one);
            },
            delete(one) {
                const hash = this.at.get(one);
                const group = this.under.get(hash);

                this.at.delete(one);
                group?.delete(one);
                if (group?.size === 0) this.under.delete(hash);
            },
            // The members a removal may have taken: those filed under its hash,
            // or all of them.
            asked(hash) {
                return hash === undefined ? [...this.at.keys()] : [...(this.under.get(hash) ?? [])];
            }
        });
        const walk = {
            visited: ledger(),
            // The members of the pass not reached yet, filed only once a call
            // that removes asks for them: a walk nothing removes from pays
            // nothing for them.
            due: null,
            entries: [],
            reached: 0,
            // What arrived since the last pass, and whether the set changed in
            // a way that only reading it all again tells.
            arrivals: [],
            rescan: false,
            pass(entries) {
                this.entries = entries;
                this.reached = 0;
                this.due = null;
                return entries;
            },
            pending() {
                if (this.due === null) {
                    this.due = ledger();
                    for (let at = this.reached; at < this.entries.length; at++) this.due.add(...this.entries[at]);
                }

                return this.due;
            },
            changed(name, args, result) {
                // A member added is what the set now holds for it, met at its
                // turn, after the others; anything else that may have added
                // is read again, once per call.
                if (name === 'add') {
                    const hash = filed(args[0]);
                    const one = hash === undefined ? MISSING : kept(args[0], hash);

                    if (hash === undefined) this.rescan = true;
                    else if (one !== MISSING && !this.visited.at.has(one)) this.arrivals.push([one, hash]);

                    return;
                }

                // A call that only takes members away adds none to read again.
                if (!REMOVING.has(name)) this.rescan = true;
                if (ARRIVING.has(name)) return;

                // A single removal takes a member equal to the one it names,
                // filed under the same hash, so only those under it are asked;
                // any other change asks every member.
                const named = name === 'pop' ? result : name === 'discard' || name === 'remove' ? args[0] : MISSING;
                const due = this.pending();
                const hash = named === MISSING ? undefined : (this.visited.at.get(named) ?? due.at.get(named) ?? filed(named));

                // A member visited that left is forgotten; one the set now
                // holds as another object stayed, and its visit goes to that
                // object.
                for (const one of this.visited.asked(hash)) {
                    const filedUnder = this.visited.at.get(one);
                    const same = kept(one, filedUnder);

                    if (same === one) continue;

                    this.visited.delete(one);
                    if (same !== MISSING) this.visited.add(same, filedUnder);
                }

                // A member not reached yet that left is due no more: added
                // back, it arrives as any member does, after the others, and
                // not where it stood.
                for (const one of due.asked(hash)) {
                    if (kept(one, due.at.get(one)) !== one) due.delete(one);
                }
            }
        };
        const marker = MARKS.get(value) ?? mark(value);
        const ref = new WeakRef(walk);
        const members = () => {
            const entries = [];

            for (const [hash, bucket] of Object.entries(value.$store)) {
                for (const one of bucket) if (!walk.visited.at.has(one)) entries.push([one, hash]);
            }

            return entries;
        };

        (marker.walks ??= new Set()).add(ref);

        try {
            let entries = walk.pass(members());

            while (entries.length > 0) {
                for (let at = 0; at < entries.length; at++) {
                    const [one, hash] = entries[at];
                    const waiting = walk.due === null || walk.due.at.has(one);

                    walk.reached = at + 1;
                    walk.due?.delete(one);

                    if (!waiting || walk.visited.at.has(one) || !present(one, hash)) continue;

                    walk.visited.add(one, hash);
                    yield forReader(one);
                }

                entries = walk.pass(walk.rescan ? members() : walk.arrivals);
                walk.arrivals = [];
                walk.rescan = false;
            }
        } finally {
            marker.walks.delete(ref);
            // The target of a weak reference lives until the job that made it
            // ends: what the walk recorded goes now, or a loop walking the set
            // again and again in one job keeps the records of every walk.
            walk.visited = walk.due = null;
            walk.entries = walk.arrivals = [];
        }
    }

    keys() {
        return this.#members();
    }

    *entries() {
        for (const one of this.#members()) yield [one, one];
    }

    [Symbol.iterator]() {
        return this.#members();
    }

    // A callback refused before any row, an empty set included, in the words
    // the engine's own `forEach` refuses it with, and called as itself:
    // `callback.call` is a property, which the author may have set.
    forEach(callback, receiver) {
        if (typeof callback !== 'function') Reflect.apply(Set.prototype.forEach, new Set(), [callback]);

        for (const one of this.#members()) Reflect.apply(callback, receiver, [one, one, this.#published]);
    }

    // The set algebra `Set.prototype` gained reads its receiver's own storage,
    // so it is answered from the members here, with a `Set` for a result, step
    // for step as the specification writes it: the argument taken and refused
    // as there (`setRecord`), and the smaller side walked, which decides the
    // order of an intersection.
    union(other) {
        const record = setRecord(other);
        const keys = keysOf(record);
        const result = new Set(this.#members());

        for (const one of keys) result.add(one);

        return result;
    }

    intersection(other) {
        const record = setRecord(other);
        const result = new Set();

        if (this.#size <= record.size) {
            for (const one of this.#members()) if (record.has(one)) result.add(one);
        } else {
            for (const one of keysOf(record)) if (this.#has(one)) result.add(one);
        }

        return result;
    }

    difference(other) {
        const record = setRecord(other);
        const result = new Set(this.#members());

        // The members as they were, as the specification walks its copy: a
        // `has` that changes this set does not change what is asked.
        if (this.#size <= record.size) {
            for (const one of [...result]) if (record.has(one)) result.delete(one);
        } else {
            for (const one of keysOf(record)) result.delete(one);
        }

        return result;
    }

    symmetricDifference(other) {
        const record = setRecord(other);
        const keys = keysOf(record);
        const result = new Set(this.#members());

        for (const one of keys) {
            if (this.#has(one)) result.delete(one);
            else result.add(one);
        }

        return result;
    }

    isSubsetOf(other) {
        const record = setRecord(other);

        if (this.#size > record.size) return false;
        for (const one of this.#members()) if (!record.has(one)) return false;

        return true;
    }

    isSupersetOf(other) {
        const record = setRecord(other);

        if (this.#size < record.size) return false;
        for (const one of keysOf(record)) if (!this.#has(one)) return false;

        return true;
    }

    isDisjointFrom(other) {
        const record = setRecord(other);

        if (this.#size <= record.size) {
            for (const one of this.#members()) if (record.has(one)) return false;
        } else {
            for (const one of keysOf(record)) if (this.#has(one)) return false;
        }

        return true;
    }
}

// What a set method takes of its argument, `size`, `has` and `keys`, read and
// refused as `Set.prototype` refuses them (GetSetRecord): something that is not
// an object, a size that is not a number or is negative, a `has` or a `keys`
// that cannot be called.
const setRecord = (other) => {
    if (other === null || (typeof other !== 'object' && typeof other !== 'function')) {
        throw new TypeError('The argument of a Set method must be a set-like object');
    }

    const size = +other.size;

    if (Number.isNaN(size)) throw new TypeError("The 'size' of a set-like object must be a number");

    const whole = Math.trunc(size);

    if (whole < 0) throw new RangeError("The 'size' of a set-like object must not be negative");

    // Each read and refused before the next is read, in the specification's
    // order: a getter of `keys` does not run for a `has` already refused.
    const has = other.has;

    if (typeof has !== 'function') throw new TypeError("The 'has' of a set-like object must be a function");

    const keys = other.keys;

    if (typeof keys !== 'function') throw new TypeError("The 'keys' of a set-like object must be a function");

    return {
        size: whole,
        has: (one) => Boolean(Reflect.apply(has, other, [one])),
        keys: () => Reflect.apply(keys, other, [])
    };
};

// The keys of a set method's argument, taken as the specification takes them
// (GetIteratorFromMethod): `keys()` called and its `next` read there and then,
// which a union and a symmetric difference do before they copy their receiver,
// so that what either does to it is in the copy. Walked with `for…of`, which
// closes the iterator on an early return, its `return` read when it closes.
const keysOf = (record) => {
    const iterator = record.keys();

    if (iterator === null || (typeof iterator !== 'object' && typeof iterator !== 'function')) {
        throw new TypeError("The 'keys' of a set-like object must return an object");
    }

    const next = iterator.next;
    const stepper = {
        next: () => Reflect.apply(next, iterator, []),
        get return() {
            const close = iterator.return;

            return close === undefined || close === null ? undefined : () => Reflect.apply(close, iterator, []);
        }
    };

    return { [Symbol.iterator]: () => stepper };
};

// Handed out behind a proxy of its own, as every other view is: the set's own
// storage stays empty, so what reads that storage rather than the methods
// would read nothing in silence. `structuredClone` refuses a proxy, as it does
// a list's view, where it copied an empty `Set`, and `Set.prototype.has.call`
// refuses its receiver. A method is read off the view and runs on it, its
// fields being private; one bound function per function read, so `view.has`
// is one value, and a function put in its place is the one called. Bound by
// JavaScript's own `bind`, not by whatever the function holds under that name.
// Each set view's proxy, by the object behind it (`#published`).
const PUBLISHED_SETS = new WeakMap();

function setView(value) {
    const target = new SetView(value);
    const bound = new WeakMap();
    const view = new Proxy(target, {
        get(shell, key) {
            // A member JavaScript put on the view is the view's, as on a `Set`:
            // its value handed back as it is, which a locked or frozen one
            // demands, and its getter run with the view as `this`, its
            // `constructor` too. Only the set's own methods run on the object
            // behind, whose private fields they read.
            if (Object.hasOwn(shell, key)) return Reflect.get(shell, key, view);

            // Otherwise its constructor is `Set`, as a list's view's is
            // `Array`: what a copy made by it is, `new data.constructor(data)`
            // as lodash's `cloneDeep` writes it, where `SetView` took its
            // argument for a Python set and raised from inside the engine.
            if (key === 'constructor') return Set;

            // A member of the set's own class reads its private fields, and runs
            // on the object behind. Any other a prototype holds, `Object`'s
            // `valueOf`, a method or a getter put on a prototype, runs on the
            // view, as on a `Set`: run on the object behind, `valueOf()` handed
            // that object out, back in Python another object, and a copy of
            // its empty storage an empty set.
            let holder = Object.getPrototypeOf(shell);

            while (holder !== null && !Object.hasOwn(holder, key)) holder = Object.getPrototypeOf(holder);

            const own = holder === SetView.prototype;
            const found = Reflect.get(shell, key, own ? shell : view);

            if (!own || typeof found !== 'function') return found;
            if (!bound.has(found)) bound.set(found, Reflect.apply(Function.prototype.bind, found, [shell]));

            return bound.get(found);
        }
    });

    PUBLISHED_SETS.set(target, view);
    VIEW_OF.set(value, view);
    VIEWED.add(view);
    globalThis.__BRYTHON__.PYOBJ_MAP.set(view, value);

    return view;
}


// Whether a read through the dot would find an attribute, answered without
// reading it: a write that asked `$getattr` would run the getter of the property
// it is about to set, and a getter that counts or refuses would see a read the
// assignment never makes. The class
// dictionaries and the instance's own say where an attribute lives, and they
// are asked first, whatever protocol the class adds. A JavaScript object
// answers through `in`, its own properties and inherited ones, which runs no
// getter, as an assignment in JavaScript reads none. Only a name found in
// neither, on a class with its own `__getattr__` or `__getattribute__`, is left
// to the protocol, the one thing that can answer for an attribute nothing
// declares.
export function attributed(target, name) {
    const $B = globalThis.__BRYTHON__;
    const type = pyType(target);

    if (type === undefined) {
        const object = target !== null && (typeof target === 'object' || typeof target === 'function');

        return object ? name in target : $B.$getattr(target, name, MISSING) !== MISSING;
    }
    if (declares(type, name) !== $B.NULL) return true;

    const own = ownAttributes(target);

    if (own !== undefined && $B.is_dict(own) && _b_.dict.$contains(own, name)) return true;

    const base = $B.search_in_dict(_b_.object, '__getattribute__', $B.NULL);

    if (declares(type, '__getattr__') === $B.NULL && declares(type, '__getattribute__') === base) return false;

    return $B.$getattr(target, name, MISSING) !== MISSING;
}

// What a `bindable` prop holds, read by Python: the value Python wrote when the
// prop holds what that write handed over (`handOver`), and whatever it holds
// otherwise. A bound parent's setter decides what the prop holds, the value
// refused and the old one kept, or another put in its place, and the child
// reads that, as a child in Svelte does.
//
// Nothing else is given back. The write remembered what it wrote under
// whatever the prop held after it, for the day Svelte wrapped a Brython list in
// a state proxy, and so read the parent's decision as the child's proposal. A
// list, a dict or an instance crosses as its view now, which Svelte does not
// wrap, and is itself again; a JavaScript object Python wrote reads back as
// Svelte's proxy of it, as it does in a child written in Svelte.
//
// And the default it declares (`declared`), which Svelte holds as it crosses
// while the parent passes nothing: Python reads it as it was written, `15.0`
// and not the `15` it crossed as, unless the child's own write is what the
// prop holds.
export const unproxied = (value, crossed, passed, declared) =>
    crossed != null && Object.is(value, crossed.js)
        ? crossed.py
        : declared !== undefined && passed === undefined && Object.is(value, declared.value)
          ? declared.py
          : value;

// **A scalar Python writes into a `bindable` prop crosses as JavaScript's own**,
// because the parent may be JavaScript: a float handed to it as the Brython
// object it is has no `toFixed`. And the parent may be Python, which wants the
// float it was written, `15.0` and not the `15` a JavaScript number reads back
// as. Both, because the parent's setter runs inside the write: the original is
// handed over beside the number for exactly that long, and `pyBind` takes it
// back when it meets the number it stands for. What comes back is what the
// child keeps as well (`crossed`), so its own read gives the float again while
// Svelte still holds the number it wrote. A list, a tuple or a dict crosses as
// its view (`viewOf`), which a JavaScript parent reads and writes live; a
// string or an int is its own JavaScript form and crosses as itself. The pair
// handed over is the crossing's to know (`lent.handed`).
export const handOver = (written, write) => {
    const crossing = viewOf(plainScalar(written));

    // A value that is its own JavaScript form is kept all the same: what the
    // prop holds is then the child's write, and not the default it declares.
    if (crossing === written) {
        write(written);

        return { js: written, py: written };
    }

    const record = { js: crossing, py: written };
    const previous = lent.handed;

    lent.handed = record;

    try {
        write(crossing);
    } finally {
        lent.handed = previous;
    }

    return record;
};

// **Every Python callable the engine hands to JavaScript goes through
// `pyHandler`.** Brython converts the arguments of any JavaScript call it makes
// (a method of a namespace or of an object a library returned or resolved, a
// constructor through `.new`, a property written, a global like
// `setTimeout`) with its own `pyobj2jsobj`, whose callback trims nothing and
// is not the function `pyHandler` publishes for the same callable. The engine
// asks `$B.pyobj2jsobj_hook` first, an extension point proposed upstream and
// vendored (see BRYTHON_FIX.md), so the conversion has one site and one
// contract.
//
// A Python list, tuple, dict or set and an instance of the author's class are
// answered too, by their view, as a named import's arguments are (`outbound`)
// and as at a prop and an export: handed to a JavaScript function or written
// into a JavaScript object, `config.tags = tags`, they are Python's own, so a
// later `tags.append(…)` is there and a write from JavaScript is Python's. The
// engine's own walk made a copy, which missed every later mutation, or left
// the value itself, which JavaScript cannot read. The callable question comes
// first: a list subclass that defines `__call__` is a callback.
//
// Anything else goes on to the engine.
globalThis.__BRYTHON__.pyobj2jsobj_hook = (value) => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
    if (declared(value) !== null || ADAPTERS.has(value)) return pyHandler(value);
    if (pyBytes(value)) return bytesOut(value);

    const view = viewOf(value);

    return view === value ? undefined : view;
};
