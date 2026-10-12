// What every compiled component imports. `globals.js` prepares the scope
// brython.js reads as it loads, and `boot.js` imports the engine itself and
// starts it.
import './globals.js';
import './boot.js';
import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
// What `$effect.tracking()` compiles to: a plain module has no runes.
import { effect_tracking } from 'svelte/internal/client';
import { attributeWrapper } from './attributes.js';

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

// Svelte interpolates with String(), and None is an object, so it would render
// "[object Object]". Non-enumerable so nothing that walks the singleton's
// properties can see it. (The same gap remains for lists and dicts, which
// render with JavaScript's stringification rather than Python's str().)
Object.defineProperty(NONE, 'toString', {
    value: () => 'None',
    enumerable: false,
    configurable: true
});

const _b_ = globalThis.__BRYTHON__.builtins;

// Inside a Svelte template you are in JavaScript, not Python, and the two
// disagree. This is the bridge behind `__truthy`, `__text`, `__seq` and
// `__spread`, the four names a compiled template expression actually calls.
//
// Only generated code types it, so its name takes no word an author may want
// from the component's scope.
// An exception the author's own Python raised, as opposed to a conversion that
// could not be made.
//
// `truthy` and `str` try Python first and fall back to JavaScript, and the
// fallback is there for a foreign value (a DOM node, a JavaScript object),
// which Brython's own classifier trips on, and not for the author's own error:
// a `__bool__` or a `__str__` that raises goes on, rather than leaving a
// plausible page.
//
// Told apart by the *error*, not by the value, which keeps the value itself
// untouched: it may be a proxy that records every key read. A Brython exception
// is a plain object carrying `ob_type` and a `__traceback__`; it is not an
// `instanceof Error`, and it has no `__class__` either.
const raised = (error) =>
    error !== null &&
    typeof error === 'object' &&
    pyClass(ownType(error)) &&
    error.__traceback__ !== undefined;

// An array-shaped Python value, as *its class* says it iterates.
//
// A Brython list is a JavaScript array, so anywhere this file walks elements it
// can walk the storage with no conversion at all, and for a list or a tuple that
// is exactly right. It stops being right the moment a subclass redefines
// `__iter__`: `[x for x in rows]` may answer `[3, 2, 1]` for a storage of
// `[1, 2, 3]`, and the template's loop, the crossing and `tojson` answer what
// Python answers. The storage is not the sequence when the author has said
// otherwise, and this is the one place that knows it.
//
// `list()` is not the road: Brython's constructor copies the storage of anything
// array-shaped, so asking it answers the question with the question.
// `make_js_iterator` is, and it carries both of the other obligations. It runs
// `iter()`, the only call that *validates* the protocol: an `__iter__` that
// returns a plain list is a TypeError in the script and in the template alike.
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
function iterated(value) {
    // Asked of the *class*, as the two converters ask it: `ob_type` is a field
    // name, and a JavaScript array is as free to carry one as an object is,
    // `{ob_type: "business"}` among them. The loop, `batch`, the export,
    // `tojson`, the argument boundary and `plainData` all ask it this way.
    const type = ownType(value);

    if (!pyClass(type) || type === _b_.list || type === _b_.tuple) return value;

    const $B = globalThis.__BRYTHON__;

    return $B.$list(Array.from($B.make_js_iterator(value, $B.NULL)));
}

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

// The traps of a view, each relaying what Python raises under it as a call
// does (`pyCall`): the exception itself, its message filled in, so JavaScript
// reads what went wrong and a Python caller that handed the value over still
// catches its own `ValueError`. Thrown as it came, a JavaScript reader found
// no message on it. An error of JavaScript's, a refusal of the view's own,
// passes as it is.
const relayed = (handler, where) => {
    for (const [trap, run] of Object.entries(handler)) {
        handler[trap] = function (...args) {
            try {
                return run.apply(this, args);
            } catch (error) {
                throw pyError(error, where);
            }
        };
    }

    return handler;
};

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
    if (value === null || value === undefined || value === NONE) return 'None';
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
        const members = Array.prototype.slice.call(value).map(keyText);
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

// The components written in Python, as their Python parents import them.
const PYTHON_COMPONENTS = new WeakSet();
let CROSSING_PAIR = null;

export const __pybridge = {
    // Called by each component written in Python, first of all, with itself.
    python(...components) {
        for (const one of components) if (one !== null && (typeof one === 'function' || typeof one === 'object')) PYTHON_COMPONENTS.add(one);
    },

    // A prop handed to a component a tag holds rather than names by its
    // import, a snippet's parameter or a name the script assigned: the Python
    // value itself to one written in Python, and JavaScript's to any other, as
    // a child named by its import gets it.
    child(component, value, kind = '') {
        // Handed through a `{@render}` argument, which is Python, it comes
        // back as the adapter made for it, which knows the component.
        const python = PYTHON_COMPONENTS.has(component) || PYTHON_COMPONENTS.has(ADAPTERS.get(component));
        if (kind === 'spread') return python ? __pybridge.spreadPython(value) : __pybridge.spread(value);
        if (python) return value;
        return kind === 'scalar' ? scalarOnly(value) : pyNumbers(value);
    },

    // A binding's read/write pair, for the binding Svelte takes no pair for,
    // `bind:group` on a component, written
    // `__pybridge.crossing[__pybridge.pair(read, write)]`. Svelte asks there
    // for a member of a name, and reads or writes it right after computing
    // its key, which is when the pair is handed over. It is taken off the
    // slot before it is called, so the slot holds nothing of a component once
    // used, and a read the call makes in turn hands its own.
    pair(read, write) {
        CROSSING_PAIR = [read, write];
        return 'value';
    },
    crossing: {
        get value() {
            const [read] = CROSSING_PAIR;
            CROSSING_PAIR = null;
            return read();
        },
        set value(value) {
            const [, write] = CROSSING_PAIR;
            CROSSING_PAIR = null;
            write(value);
        }
    },

    // The value of `class={…}` on an element, which Svelte hands to `clsx`: a
    // string as it is, a dict as an object whose values are Python's truth, a
    // list as the names Python finds true. `clsx` would read JavaScript's truth
    // and walk into any object, `None` included, whose keys are the engine's.
    klass(value) {
        if (value === null || value === undefined || value === NONE) return undefined;
        if (typeof value !== 'object') return value;

        if (globalThis.__BRYTHON__.is_dict(value)) {
            // `define`, because the key is the author's: `"__proto__"` is a
            // class name here, not the object's prototype.
            const out = {};
            for (const [key, one] of pyEntries(value)) define(out, __pybridge.str(key), __pybridge.truthy(one));
            return out;
        }

        // An object a JavaScript parent handed over, `{active: true}`, is what
        // Svelte reads as a set of conditional classes, and is handed to it as
        // it is, read the way it reads it.
        if (!pyClass(ownType(value)) && !VIEWED.has(value) && plainObject(value)) return value;

        // The names the list yields, which for a subclass with its own
        // `__iter__` are not the ones it stores: the loop beside it reads the
        // same ones. A set is the natural type for a set of classes, and is
        // read the same way.
        if (Array.isArray(value) || isSet(value)) {
            return iterated(value)
                .filter((one) => __pybridge.truthy(one))
                .map((one) => __pybridge.klass(one));
        }

        return __pybridge.truthy(value) ? __pybridge.str(value) : undefined;
    },

    // A key of `{#key}` and of an `{#each}`, which Svelte compares with `===`.
    // A list, a dict, a set or an instance is the same object while it lives,
    // so it keys by identity: two equal rows are two rows, and a row mutated
    // keeps its block. A value rebuilt each time keys by `keyText`, the text
    // equal values share. A NaN, equal to nothing, gets a key object of its
    // own, since the float itself would reach Svelte as the number NaN, which
    // no comparison finds again.
    key(value) {
        // `None` is JavaScript's `null`, so `set_context(None, …)` and
        // `getContext(null)` name one entry, as every other door makes it.
        if (value === NONE) return null;
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
    },

    // JS calls every object truthy, so `{#if items}` would be true for an empty
    // list, an empty dict, or None. Conditions are rewritten to go through this.
    truthy(value) {
        if (value === undefined || value === null) return false;
        // str/int/float/bool are JS primitives in Brython, and there the two
        // languages already agree.
        if (typeof value !== 'object' && typeof value !== 'function') return Boolean(value);
        try {
            return _b_.bool.$factory(value) === true;
        } catch (error) {
            if (raised(error)) throw error;
            return Boolean(value);
        }
    },

    // `hidden`, a boolean attribute with a third state: `until-found` is kept
    // as the string, the one value Svelte renders as it is. Any other value is
    // Python's truth, as for the other boolean attributes.
    hidden(value) {
        const text = typeof value === 'string' ? value : pyScalar(value);
        if (text === 'until-found') return text;
        return __pybridge.truthy(value);
    },

    // Python's str(), for interpolation: `['a', 'b']` rather than `a,b`.
    //
    // None renders as nothing, like null and undefined beside it. In a template
    // the default failure is absence, not an error, and not printing a word
    // that means nothing to whoever is reading the page. `str(None)` is still
    // "None" in the script, where a developer is the reader; this is the markup,
    // where they are not. Svelte renders null and undefined as empty for the
    // same reason, and a prop the parent never passed arrives here as None.
    str(value) {
        if (value === undefined || value === null || value === NONE) return '';
        try {
            return _b_.str.$factory(value);
        } catch (error) {
            if (raised(error)) throw error;
            return String(value);
        }
    },

    // A JavaScript array handed back to Python. A list *is* an array in Brython,
    // but not every array is a list: one built here, by `.slice()` say, reads
    // as a `JavascriptArray`, which prints `[A, B]` where Python prints
    // `['A', 'B']`. Anything a helper hands to Python goes through this.
    list(items) {
        return _b_.list.$factory(items);
    },

    // What a `<select multiple>` writes back: Svelte's array of the chosen
    // options' values, which is a list in Python, with a list's methods, each
    // value crossing as a binding's does.
    selected(value) {
        return Array.isArray(value) ? _b_.list.$factory(value.map(pyBind)) : pyBind(value);
    },

    // `{#each}` walks a JavaScript array. A Python list or tuple already is one,
    // but a dict, a set, a range, a generator or the result of .items() is not,
    // and iterating those is the whole point of writing the loop in Python.
    seq(value) {
        if (value === undefined || value === null) return [];

        let rows;

        if (Array.isArray(value)) {
            // What the class says it yields, which for a list is the array
            // itself and one identity compare.
            rows = iterated(value);
        } else {
            try {
                // Everything else Python calls iterable, materialised once. A
                // generator is spent by this and the walk below reads the list,
                // never the iterator again.
                rows = _b_.list.$factory(value);
            } catch (error) {
                // Told apart by the *error*, the way `truthy` and `str` above
                // are, and for the same reason: the value itself cannot say
                // which of the two happened.
                //
                // A Brython exception is Python saying it has no way to iterate
                // this. Anything else came out of **the author's own iterator**,
                // and the attempt has already walked part of it: read as *not
                // Python's to convert*, a JavaScript generator that throws on its
                // second step would be handed back spent, and the author's
                // message lost.
                //
                // No Python object carries `Symbol.iterator` but a list, and a
                // list took the branch above, so a Python generator that
                // raises mid-iteration cannot reach this either.
                if (!raised(error) || !(value && typeof value[Symbol.iterator] === 'function')) {
                    throw error;
                }

                // A foreign JavaScript iterable Python has no protocol for, a
                // NodeList from bind:this. Nothing of ours watches it, so it
                // leaves before the rule below.
                return value;
            }
        }

        // Hand the watch down to the rows: {#each} walks the array in
        // JavaScript, never through $getitem, so this is the only path by which
        // an item can come under watch before its block reads it.
        //
        // The rows the loop is given, and not where they came from: the
        // storage of a list subclass is not what a redefined `__iter__` yields,
        // and a plain class with an `__iter__`, a collection by composition,
        // has rows too. Once the rows exist the question is the same for every
        // shape, so it is asked once, here.
        if (MARKS.has(value)) {
            for (const item of rows) inherit(value, item);
        }

        return rows;
    },

    // What Python hands *out* to a DOM boundary: a `bind:`, and an attribute
    // or prop written `href={value}`. Python's None is an object, so Svelte
    // would write it straight through: an `<input>` shows the word "None",
    // `href` becomes the string "None", and `bind:files` fails outright with
    // `Failed to convert value to FileList`. Undefined is what JavaScript means
    // by "nothing here yet": Svelte drops an attribute set to it, and its own
    // bindings expect it.
    //
    // Only None. Zero, an empty string and False are values a binding must keep.
    //
    // And a Python callable, handed to a prop as `cb={run}`, is adapted the way
    // the same callable one level down already is, `config={{'cb': run}}`: a
    // JavaScript child calls it with its own numbers and arguments, and a raw
    // function raised on them where the nested one answered.
    bound(value) {
        if (value === NONE) return undefined;

        return value !== null && (typeof value === 'object' || typeof value === 'function') && callable(value)
            ? pyHandler(value)
            : viewOf(value);
    },

    // A `bind:group` control's `checked`, written by the server, where no action
    // runs: whether the model holds the control's value, by Python's `==`, as
    // Svelte's server writes it for its own group. In the browser the action
    // keeps the control, and this answers nothing, which Svelte leaves alone;
    // the model and the value are handed over as reads, so the browser reads
    // neither.
    groupChecked(model, chosen, boxes) {
        if (typeof document !== 'undefined') return undefined;

        const value = chosen();

        if (value === undefined) return undefined;

        const mine = pyBind(value);
        const current = model();
        const same = (one) => {
            try {
                return __pybridge.truthy(globalThis.__BRYTHON__.rich_comp('__eq__', one, mine));
            } catch (error) {
                if (raised(error)) throw error;

                return one === mine;
            }
        };

        return boxes ? Array.from(current === NONE ? [] : (current ?? [])).some(same) : same(current);
    },

    // What a context holds, written by Python. Either end may be JavaScript's,
    // so a callable is published as at every other door (`pyHandler`) and a
    // JavaScript reader can call it; a scalar is made JavaScript's, `None` its
    // `null`, which a JavaScript reader takes for an absence; a container is
    // the object it is.
    toContext(value) {
        return value !== null && (typeof value === 'object' || typeof value === 'function') && callable(value)
            ? pyHandler(value)
            : viewOf(plainScalar(value));
    },

    // A value handed into Python by a door that may be JavaScript's, a context
    // or a snippet's parameter: what Python published is its own callable
    // again, so a Python reader holds what a Python writer held; a JavaScript
    // function is the adapter an import of it gets (`jsCall`), which converts
    // what Python hands it and what it answers; anything else is read as
    // `pyBind` reads it, a view its container.
    received(value) {
        if (typeof value !== 'function') return pyBind(value);

        return PUBLISHED.get(value) ?? (declared(value) === null ? jsCall(value) : value);
    },

    // `set_context` and `get_context`. A scalar is set as JavaScript's own, for
    // a JavaScript reader, and its original kept in the context too, for a
    // Python one: `Price(0.5)` reads back a `Price` and `1.0` a float, where the
    // number alone would read back `0.5` and `1`.
    //
    // Kept in a map of their own under one key of Svelthon's, which a
    // component copies from its parent's the first time it publishes, as
    // Svelte copies the context map itself; `own` hands that context map,
    // `getAllContexts`, asked only once the key is set, so that a call made
    // outside initialisation is refused under the name Svelte gives the same
    // call written in JavaScript, `setContext`. An original lives as long as the
    // context holding it, a child's never reaches its parent, and one key has
    // one entry, the latest, a value published again letting the one it
    // replaces go. The original is taken only while the key still holds the
    // value it was made into: a JavaScript component between the two that
    // sets the key again to another value is read as it set it, and to an
    // equal one leaves the original standing, a number not saying who wrote
    // it.
    provide(set, get, own, key, value) {
        const out = __pybridge.toContext(value);

        set(key, out);

        let originals = get(ORIGINALS);
        const owner = own();

        if (originals?.owner !== owner) {
            originals = { owner, byKey: new Map(originals?.byKey) };
            set(ORIGINALS, originals);
        }

        originals.byKey.set(key, { js: out, py: value });
    },

    provided(get, key) {
        const value = get(key);
        const original = get(ORIGINALS)?.byKey.get(key);

        return original !== undefined && Object.is(value, original.js) ? original.py : __pybridge.received(value);
    },

    // `{...attrs}`: Svelte diffs the spread object against the one from the
    // previous render, and a dict mutated in place *is* the same object. In
    // JavaScript the problem does not arise: spreading a $state proxy produces a
    // fresh object on every evaluation. So a shallow copy is returned, and a
    // Python spread renders exactly like its JavaScript counterpart.
    //
    // **And the values in it cross the boundary the attribute beside them
    // crosses.** Copying was the whole job while a dict held strings and
    // numbers, so a None inside one went to the DOM as the Python object it
    // is: `{**{"title": None}}` wrote the word `None` where `title={None}`
    // removed the attribute, and `{**{"disabled": None}}` disabled a control
    // nobody had disabled, which is a form the reader cannot use. Moving an
    // element's attributes into a dict changed what they meant.
    //
    // The rule is `bound`, just above, and this is the second site that hands
    // an attribute over. It is asked rather than repeated: what "absent" means
    // at a DOM boundary is one sentence, and it is written there.
    //
    // On a component each value is a prop, and crosses as one written by name
    // does: `bound`, then the floats of a config made numbers by `pyNumbers`, a
    // level down from the value. Converting the dict of props alone left them
    // a level further down than a prop written by name, so `{**attrs}` handed
    // a child `config.rate` as a Brython float where `config={config}` handed
    // it a number.
    spread(value) {
        return spreadOf(value, (one) => pyNumbers(__pybridge.bound(one)));
    },

    // The same props handed to a child written in Python, each the Python value
    // itself, as one written by name is handed to it.
    spreadPython(value) {
        return spreadOf(value, __pybridge.bound);
    },

    // A spread on an element: each key is the attribute it becomes, read the
    // way that attribute is read when written by name. Only None is converted
    // first, as the direct path converts it: an object stays the object, which
    // is how an `<option>`'s value finds its `<select>`.
    //
    // A key Svelte takes for a handler, one beginning with `on`, is adapted as
    // a handler written by name is, by the component's `event`: a raise reaches
    // the page as an `Error` and a coroutine is run and its failure reported,
    // where a callback's contract handed the host the Brython exception and a
    // rejected promise nobody looks at.
    //
    // Each property is read once, as a JavaScript spread reads it: a getter
    // asked again may answer otherwise, or refuse.
    spreadElement(value, event = (one) => pyEvent(one)) {
        if (value === null || value === undefined) return value;

        const read = spreadOf(value, (one) => one);
        const out = spreadOf(read, __pybridge.bound);

        for (const key of Object.keys(out)) {
            const wrapper = attributeWrapper(key);
            if (key[0] + key[1] === 'on') out[key] = event(read[key]);
            else if (wrapper === '__class') out[key] = __pybridge.klass(read[key]);
            else if (wrapper === '__truthy') out[key] = __pybridge.truthy(read[key]);
            else if (wrapper === '__hidden') out[key] = __pybridge.hidden(read[key]);
        }

        return out;
    }
};

// A spread's copy, each value converted: a fresh object, as a JavaScript spread
// of a `$state` proxy is, so Svelte's diff sees a dict mutated in place.
//
// **What is spread is the entries, each language's own.** A Python value is
// what `**` takes of it in the markup (`starredEntries`), the rest of a row's
// own rule: a mapping's entries as `{**value}` reads them, an instance's
// attributes; each key written as the copy writes it (`propertyName`) and a
// symbol kept as itself. A JavaScript object is its own enumerable properties,
// symbols included, as JavaScript's `...` takes them. Copied as a JavaScript
// object, a dict handed its child the engine's storage beside its keys, a key
// that is not a string never arrived, and a mapping that is not a dict or an
// instance arrived empty. A str, an int and a bool are Python's, refused as a
// rest refuses them, where JavaScript's `...` spread a string's characters.
function spreadOf(value, convert) {
    if (value === null || value === undefined) return value;

    const out = {};

    if (javaScriptRow(value)) {
        for (const key of Reflect.ownKeys(value)) {
            if (Object.prototype.propertyIsEnumerable.call(value, key)) define(out, key, convert(value[key]));
        }

        return out;
    }

    for (const [key, one] of starredEntries(value)) define(out, propertyName(key, out), convert(one));

    return out;
}

// Methods that change a container.
//
// `__setitem__` and `__delitem__` are here: Brython compiles `d[k] = v` and
// `del d[k]` to their own calls, caught below, which is about the *statement*.
// An author calling the method by name is ordinary Python and is what a generic
// helper writes: `rows.__setitem__(0, 1)`, the same method kept as a value, or
// reached through the type. Those three reach the container and nothing else.
// The in-place operators and `__init__` are the same case: `rows += [1]` goes
// through `augm_assign`, and `rows.__iadd__([1])` or `list.__init__(rows, [2])`
// through nothing else.
//
// And an attribute written or deleted by name, `object.__setattr__(box, "value",
// 1)`: the same write `box.value = 1` makes, reached through the type.
//
// And a view's life ending, `release()` or the exit of `with view:`: its
// buffer does not change, the view does, and every read of it now raises.
//
// And an exception's own: `add_note()` writes `__notes__`, `with_traceback()`
// `__traceback__`, each inside the engine.
const MUTATORS = new Set([
    '__setitem__', '__delitem__', '__init__', '__setattr__', '__delattr__',
    '__iadd__', '__imul__', '__ior__', '__iand__', '__isub__', '__ixor__',
    'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'sort', 'reverse',
    'add', 'discard', 'update', 'setdefault', 'popitem', 'appendleft',
    'extendleft', 'popleft', 'rotate', 'intersection_update',
    'difference_update', 'symmetric_difference_update', 'release', '__exit__',
    'add_note', 'with_traceback'
]);

// Methods that hand out a container the caller can then mutate, without any
// indexing to catch it.
const VIEWS = new Set(['items', 'values']);

// Every name a call on a watched container has to be followed up on: the
// builtin methods of these names are wrapped once, where the engine keeps them
// (`atSource`). `__getattribute__` among them: called by name,
// `type(box).__getattribute__(box, "x")`, it is the read `box.x` makes.
const FOLLOWED = new Set([...MUTATORS, ...VIEWS, 'get', '__getattribute__']);

// Make an in-place mutation reactive: `items.append(x)` with nothing after it.
//
// Svelte's own answer is to proxy the value in depth, which is unusable here: a
// Python object behind a JavaScript proxy fails Brython's own type checks
// (`repr((1, 2))` raises "requires a 'tuple' object but received a 'tuple'").
//
// So a watched object is given a marker instead, held outside it in a WeakMap,
// `MARKS`: the object is the one Brython made, `type(items) is list` stays true,
// `repr` is untouched, and nothing that walks the value can see the marker.
//
// The rule the code below holds is one sentence: a watched container notifies
// whenever it is mutated, and every container inside a watched one is watched
// too. Brython offers no single choke point for either half, so both are taken
// where they happen.
//
// A mutation is caught at the call, whether Python wrote it on the object or
// took the method off it first, and at an indexed or attribute write. The watch
// is handed down at the two moments a container can find itself inside another:
// it was already there when the watch began, which `mark` walks, or it arrives
// afterwards through a mutator, an index or an attribute, which each pass it on.
//
// Covering the ways *in* is what leaves reading alone: `for row in rows` and
// `list(rows)[0]` hand out a row that is watched already, so Brython's own
// iteration and copying are untouched, and so is every other builtin that
// reaches inside a container. Every check reads the marker first, so an object
// nobody watches pays one WeakMap miss and nothing else.
//
// The marker follows the object: a list handed to a helper that mutates it
// deep inside a function still notifies, which no static analysis could do.
function installMutationTracking($B) {
    if ($B.$svelthonTracking) return;
    $B.$svelthonTracking = true;

    // A WeakMap holds no key but an object or a function, so whether something
    // is watched is one lookup, whatever it is.
    const notify = (obj) => {
        if (MARKS.has(obj)) MARKS.get(obj)();
    };

    // What a call on a watched container leaves to do, wherever the call came
    // from. `obj` is known watched and `attr` known followed by both callers.
    const afterCall = (obj, attr, result, args) => {
        // A wrapper may outlive the moment it was made: a mutator taken off an
        // object that nothing watched yet is wrapped all the same, and the
        // question of whether anybody cares belongs to the call. An object that
        // never came under watch pays one lookup and nothing else. The target of
        // an operation taken off a type is the caller's first argument, which is
        // whatever the caller passed.
        //
        // `type.__setattr__(Base, "prop", …)` and `type.__delattr__` are the
        // write `Base.prop = …` makes, and wake the readers of that name of a
        // class, watched or not, as that write does.
        if (attr === '__setattr__' || attr === '__delattr__') classNameChanged(obj, args[0]);

        // And `__getattribute__` the read `box.x` makes, followed as that read
        // is, watched or not: a Python read never hands back `undefined`, so
        // that is one that raised.
        if (attr === '__getattribute__') {
            if (result === undefined) missing(obj, args[0]);
            else read(obj, args[0], result);
            return;
        }

        if (!MARKS.has(obj)) return;

        if (MUTATORS.has(attr)) {
            // A container handed to a mutator is now inside a watched one, so
            // it comes under the same watch. This is the other half of the walk
            // `mark` does: that one takes what was already there, this one
            // takes what arrives afterwards.
            //
            // Except when the argument is a **source** rather than the content.
            // `rows.extend(items())` hands over a generator, and watching the
            // generator watches nothing: what landed inside is gone from it by
            // the time this runs. So the container is asked what it now holds,
            // the way the augmented operator's exception path already asks.
            let spent = false;

            if (attr === '__setitem__' && args.length === 2) {
                stored(obj, args[0], args[1]);
            } else if (attr === '__setattr__' || attr === '__delattr__') {
                // What the object holds now, as after `box.value = 1`.
                rewalk(obj, args[1], args[0]);
            } else {
                for (const arg of args) {
                    if (!SOURCES.has(attr)) inherit(obj, arg);
                    else if (!keeps(arg) || !inheritContents(obj, arg)) spent = true;
                }
            }

            if (spent) adopt(obj);

            if (attr === 'append') indexed(obj, obj.length - 1);
            else if (SHIFTS.has(attr) && !(attr === 'pop' && args.length === 0)) indexed(obj, 0);

            // `setdefault` is the one mutator that hands a child *back* rather
            // than taking one: the value now under the key, which it is linked
            // with. The loop above linked the arguments without one, so a row
            // added this way was searched for, through every entry of the dict,
            // the first time it changed.
            if (attr === 'setdefault') inherit(obj, result, args[0]);
            MARKS.get(obj)(attr, args, result);
        } else if (VIEWS.has(attr)) {
            // `.items()` and `.values()` hand out the children without ever
            // indexing them, so the watch is handed over here rather than on a
            // read that never happens.
            //
            // Asked of Python: a dict keeps its string keys as ordinary
            // properties and everything else in a hash table, so walking the
            // properties handed the watch to the children of `{"one": []}` and
            // not to those of `{1: []}`.
            for (const [key, child] of heldEntries(obj)) {
                inherit(obj, key);
                inherit(obj, child, key);
            }
        } else {
            inherit(obj, result); // `get`
        }
    };

    // A builtin method that changes its object is followed where the engine
    // keeps it, once: the function behind `list.append`, `dict.update` or
    // `object.__setattr__`, which every call reaches however it is written,
    // `xs.append(1)`, `list.append(xs, 1)`, `super().append(1)`, or `add =
    // xs.append` and `add(1)` one component away. Its first argument is the
    // object it changes. A read of the method hands back the engine's own
    // object, so `list.append is vars(list)["append"]` and two reads of
    // `box.__setattr__` compare equal.
    //
    // A named method sits in its type's `tp_funcs`, which `call_attr` calls
    // directly, and in its descriptor's `method`; a special one in its slot
    // wrapper's `wrapped`, which an operator does not call, `xs[0] = 1` being
    // followed at its own entry below.
    // The objects a builtin method is running on: the engine's own methods
    // call one another, `intersection_update` through `clear` and `add`, and
    // the outer call is the one mutation the author made. A call on another
    // object, a `key=` that appends to a list of its own, is its own.
    const mutating = new Map();

    const atSource = (name, method) => {
        const sourced = function (target, ...args) {
            // `finally`, because a mutator that raises has often mutated
            // already: `xs.extend(values())` consumes what the generator
            // yielded before it raised, so the list holds `[1]` and the author,
            // who caught the exception, saw the old value on the page for ever.
            // `result` stays undefined on that path; `afterCall` reads it only
            // to hand a returned container the watch.
            const inner = mutating.has(target);
            let result;

            mutating.set(target, (mutating.get(target) ?? 0) + 1);
            try {
                result = Reflect.apply(method, this, [target, ...args]);
                return result;
            } finally {
                const depth = mutating.get(target) - 1;

                if (depth === 0) mutating.delete(target);
                else mutating.set(target, depth);

                if (!inner) afterCall(target, name, result, args);
            }
        };

        // Python keeps seeing the method it asked for: `type()`, `repr()` and
        // the export boundary read `ob_type` and the fields beside it off the
        // function, which Brython sets as plain properties.
        return Object.assign(sourced, method);
    };

    // The engine's classes, recognised by shape: this runs as the module
    // loads, before `pyClass` below is defined.
    const engineClass = (value) => value !== null && typeof value === 'object' && value.tp_name !== undefined && value.tp_bases !== undefined;

    // Every class the engine has, its JavaScript array among them: a list a
    // store was handed from JavaScript is one, and Python appends to it.
    for (const cls of new Set([...Object.values(_b_), ...Object.values($B)].filter(engineClass))) {
        for (const name of FOLLOWED) {
            const descriptor = $B.search_in_dict(cls, name, $B.NULL);
            const field = typeof descriptor?.method === 'function' ? 'method' : typeof descriptor?.wrapped === 'function' ? 'wrapped' : null;

            if (field === null) continue;

            const original = descriptor[field];
            const followed = atSource(name, original);

            descriptor[field] = followed;
            if (cls.tp_funcs !== undefined && Object.hasOwn(cls.tp_funcs, name) && cls.tp_funcs[name] === original) {
                cls.tp_funcs[name] = followed;
            }
        }
    }

    // A JavaScript object Python holds, a `js.Set.new()` or a `Map`, changed
    // by its own method: nothing of the engine's runs, so the method read off
    // it under the name of one of JavaScript's mutators notifies once called,
    // in place, kept as `add = seen.add` or taken by `getattr`. One wrapper per
    // object and method, so two reads are one method. Whether anybody watches
    // is the call's question, as at `afterCall`: a factory that keeps
    // `obj.add` and hands `obj` to the state later keeps a method that
    // notifies once the object is watched.
    const JS_MUTATORS = new Set(['add', 'delete', 'clear', 'set', 'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
    const JS_WRAPPERS = new WeakMap();

    const jsMutator = (obj, method) => {
        const wrappers = JS_WRAPPERS.get(obj) ?? JS_WRAPPERS.set(obj, new WeakMap()).get(obj);

        if (!wrappers.has(method)) {
            const notified = function (...args) {
                try {
                    return Reflect.apply(method, this, args);
                } finally {
                    notify(obj);
                }
            };

            wrappers.set(method, Object.assign(notified, method));
        }

        return wrappers.get(method);
    };

    // An exception the engine changes in place as it raises it: `raise error
    // from cause` writes its `__cause__` and a raise inside an `except` its
    // `__context__` (`$raise`), and catching it writes its `__traceback__`
    // (`set_exc`). The changes `add_note` and `with_traceback` make by name,
    // which `MUTATORS` follows, made here with no method called. In a
    // `finally`, since `$raise` ends by throwing what it changed.
    for (const name of ['$raise', 'set_exc']) {
        const engine = $B[name];

        $B[name] = function (exc, ...rest) {
            try {
                return Reflect.apply(engine, this, [exc, ...rest]);
            } finally {
                notify(exc);
            }
        };
    }

    const getattr = $B.$getattr;
    $B.$getattr = function (obj, attr, ...rest) {
        let result;

        try {
            result = getattr(obj, attr, ...rest);
        } catch (error) {
            missing(obj, attr);
            throw error;
        }

        read(obj, attr, result);

        return JS_MUTATORS.has(attr) && typeof result === 'function' && javascriptOwn(obj) ? jsMutator(obj, result) : result;
    };

    // A read that found its value, however it was written: `box.x`,
    // `getattr(box, "x")`, or `type(box).__getattribute__(box, "x")` called by
    // name. The name on the classes it was looked up through, and on a watched
    // object what the read handed back.
    const read = (obj, attr, result) => {
        const holder = lookedUp(obj, attr);

        // Data, not a method: a method read is a new bound object each time,
        // and what replaces it is a write of the name.
        if (holder !== undefined && !callable(result)) linked(nameMarker(holder, attr), holder, result, undefined, true, attr);

        if (!MARKS.has(obj)) return;

        // What an attribute read hands back, the way `$getitem` treats a
        // subscript: reading is the last moment before the value could be
        // mutated, and it is the only moment for a value the initial walk cannot
        // see. `class Box: rows = []` lives on the class, deliberately shared,
        // and reaching it through a watched instance is an ordinary read.
        //
        // The read that already happened, and nothing more: no walk of the class
        // hierarchy, so no property of the author's is run by the act of
        // watching, and `inherit` steps over a function of JavaScript's, a
        // string or a class on its own.
        inherit(obj, result, undefined, true, attr);

        // And the classes the value was looked up through, when it was not the
        // object's own: linked under the object, so a write on any of them,
        // `Base.count += 1` on the one that holds it, `Middle.count = 9` on
        // one before it that now shadows it, reaches what read it through an
        // instance or a subclass. A scalar read that way carries no watch of
        // its own.
        //
        // A method or a property is followed by its name rather than linked:
        // replacing it, `Base.prop = property(...)`, or shadowing it from a
        // class between, `Middle.method = ...`, changes what the instance
        // reads; a class writing a counter or a cache of its own while one of
        // its methods runs does not, and linked, it woke every reader of every
        // instance, the method's own caller first, which read it again.
        const found = providers(obj, attr);

        if (found !== null) {
            for (const cls of found.through) {
                if (found.descriptor || found.absent) className(cls, attr).subscribe();
                else inherit(obj, cls, undefined, true);
            }
        }
    };

    // The name read along `classes`, on each up to the one whose dictionary
    // holds it, that one included: a write to any of them is what the read
    // finds next. On all of them when none holds it, since any may gain it.
    // The class that holds it, or undefined.
    const namesRead = (classes, attr) => {
        if (!Array.isArray(classes)) return undefined;

        for (const one of classes) {
            className(one, attr).subscribe();

            if ($B.search_in_dict(one, attr, $B.NULL) !== $B.NULL) return one;
        }

        return undefined;
    };

    // A read made on a class itself, `Base.method`, follows the name on the
    // classes Python looks it up through, as one made through an instance
    // does, whether the class was bound by `class` or by `=`: its MRO, and its
    // metaclass's, whose descriptors and data `Subject.prop` finds. A read
    // through `super()` follows it on the MRO of `__self_class__` after
    // `__thisclass__`, where `super().value` looks. The class that holds the
    // name, or undefined.
    //
    // Only in a reaction that follows its reads: a handler or the script's own
    // run subscribes nothing, and what a reaction reads it links itself.
    const lookedUp = (obj, attr) => {
        if (typeof attr !== 'string' || !effect_tracking()) return undefined;

        if (pyClass(obj)) {
            const meta = namesRead(quietPyType(obj)?.tp_mro, attr);
            const own = namesRead(obj.tp_mro, attr);

            // `vars(Box)` and `Box.__dict__` list every name the class holds.
            if (attr === '__dict__') className(obj, EVERY).subscribe();

            return own ?? meta;
        }

        if (ownType(obj) === _b_.super && obj.obj !== _b_.None) {
            const mro = obj.obj_type?.tp_mro;

            if (Array.isArray(mro)) {
                const after = mro.indexOf(obj.type) + 1;

                basesRead(mro.slice(0, after));

                return namesRead(mro.slice(after), attr);
            }
        }

        // An instance of the author's that no name watches, `Tile()` made in
        // the expression: what it finds on its classes is followed by name, as
        // a read made on the class is. A watched one is followed through its
        // watch.
        const type = quietPyType(obj);

        if (type !== undefined && (type.tp_flags & $B.TPFLAGS.HEAPTYPE) !== 0 && !MARKS.has(obj)) {
            return namesRead(type.tp_mro, attr);
        }

        return undefined;
    };

    // What a name of a class holds, `Shelf.rows`, is linked under a marker
    // that stands for that name: a class bound by `class` carries no marker,
    // its names being followed one by one, and appending to the list it holds
    // wakes the readers of the name, as writing the name does.
    const NAME_MARKERS = new WeakMap();

    const nameMarker = (cls, attr) => {
        let markers = NAME_MARKERS.get(cls);

        if (markers === undefined) NAME_MARKERS.set(cls, (markers = new Map()));

        let marker = markers.get(attr);

        // The class is held weakly here too: a value that outlives it, a list
        // the module shares, keeps this marker among its parents.
        if (marker === undefined) {
            const target = new WeakRef(cls);

            marker = { stamp: 0, bumps: [() => target.deref() && classNameChanged(target.deref(), attr)], reads: [], target };
            markers.set(attr, marker);
        }

        return marker;
    };

    // A read that found nothing and raised, `hasattr(box, "later")`, follows
    // the name on the classes as a read that found nothing and answered a
    // default does.
    const missing = (obj, attr) => {
        lookedUp(obj, attr);
        if (!MARKS.has(obj)) return;

        const found = providers(obj, attr);

        if (found?.absent) for (const cls of found.through) className(cls, attr).subscribe();
    };

    // A reader's dependency on one name of one class, and the write that
    // changes it: per name, so the readers of `prop` wake when it is replaced
    // and not when the class writes `reads`. And on every name, `EVERY`, for a
    // read that lists them.
    const CLASS_NAMES = new WeakMap();
    const EVERY = Symbol('every name');

    // `dir(box)` lists the names of every class the object is looked up
    // through, and of a class's metaclass: any of them gaining or losing one
    // changes the listing. The object's own names are its watch's.
    const dir = $B.builtins.dir;
    $B.builtins.dir = function (...args) {
        const result = Reflect.apply(dir, this, args);
        const [obj] = args;

        if (args.length === 1) {
            const classes = pyClass(obj) ? [...(quietPyType(obj)?.tp_mro ?? []), ...obj.tp_mro] : (quietPyType(obj)?.tp_mro ?? []);

            for (const cls of classes) className(cls, EVERY).subscribe();
        }

        return result;
    };
    Object.defineProperties($B.builtins.dir, Object.getOwnPropertyDescriptors(dir));

    const className = (cls, attr) => {
        let names = CLASS_NAMES.get(cls);

        if (names === undefined) CLASS_NAMES.set(cls, (names = new Map()));

        let entry = names.get(attr);

        if (entry === undefined) {
            const updates = new Set();

            entry = {
                updates,
                subscribe: createSubscriber((update) => {
                    updates.add(update);
                    return () => updates.delete(update);
                })
            };
            names.set(attr, entry);
        }

        return entry;
    };

    // Not while the template renders: a write made then, a getter counting its
    // reads on its class, is a side effect of the reading, which
    // Svelte refuses to make of its own state, and waking the reader would run
    // the expression that wrote it again, without end.
    const classNameChanged = (cls, attr) => {
        if (typeof attr !== 'string' || !pyClass(cls)) return;

        // The value the name held is asked again the next time a mutation of
        // it climbs to the name (`attributeHolds`), as a container's links are
        // once the container itself has changed.
        const marker = NAME_MARKERS.get(cls)?.get(attr);

        if (marker !== undefined) marker.stamp = ++changes;

        if (rendering > 0) return;

        const names = CLASS_NAMES.get(cls);

        // New bases are a new lookup for every name read through the class,
        // or through a subclass or an instance of it, all of which followed
        // the name on it: `C.__bases__ = (B,)` wakes them all.
        const woken = attr === '__bases__' ? [...(names?.values() ?? [])] : [names?.get(attr), names?.get(EVERY)];

        for (const update of woken.flatMap((entry) => [...(entry?.updates ?? [])])) update();
    };

    // What depends on the order a class is searched in, with no name read
    // along it: `issubclass(C, B)`, `isinstance(box, B)`, and a `super()`
    // starting from the classes before it. New bases on any class of it change
    // the answer.
    const basesRead = (classes) => {
        for (const one of classes) className(one, '__bases__').subscribe();
    };

    for (const [name, classOf] of [
        ['issubclass', (value) => (pyClass(value) ? value : undefined)],
        ['isinstance', (value) => quietPyType(value)]
    ]) {
        const builtin = $B.builtins[name];

        $B.builtins[name] = function (...args) {
            const result = Reflect.apply(builtin, this, args);
            const mro = classOf(args[0])?.tp_mro;

            if (Array.isArray(mro)) basesRead(mro);

            return result;
        };
        Object.defineProperties($B.builtins[name], Object.getOwnPropertyDescriptors(builtin));
    }

    // The classes an attribute read off `obj` rather than off `obj` itself
    // was looked up through, up to the one whose dictionary holds it, asked of
    // the dictionaries along the MRO, so no getter runs, and whether what it
    // holds is a descriptor, a method, a property or a slot: `{ through,
    // descriptor }`, or null for a read nothing of a class answers. Only in a
    // reaction, as `lookedUp`.
    const providers = (obj, attr) => {
        if (typeof attr !== 'string' || !effect_tracking()) return null;

        const own = pyClass(obj) ? obj : undefined;

        if (own === undefined) {
            const attributes = ownAttributes(obj);

            if (attributes !== null && typeof attributes === 'object' && Object.hasOwn(attributes, attr)) return null;
        }

        const mro = (own ?? quietPyType(obj))?.tp_mro;

        if (!Array.isArray(mro)) return null;

        const through = [];

        for (const cls of mro) {
            const found = $B.search_in_dict(cls, attr, $B.NULL);

            if (cls === own) {
                if (found !== $B.NULL) return null;
                continue;
            }

            through.push(cls);

            if (found !== $B.NULL) {
                return { through, descriptor: $B.search_slot($B.get_class(found), 'tp_descr_get', $B.NULL) !== $B.NULL };
            }
        }

        // Held by none of them: what any of them gains under this name, later,
        // is what the read finds then, `getattr(box, "extra", 0)` turning 1.
        return { through, absent: true };
    };

    const setitem = $B.$setitem;
    $B.$setitem = function (obj, key, value, ...rest) {
        // In a `finally`, like every other mutation path. A `__setitem__` of the
        // author's may store what it was given and *then* refuse it, and the
        // exception does not take the entry back out, as at `extend`, at `|=`,
        // and at `__setattr__`. The shape is the one every mutation path has,
        // and `tests/mutation-notifies-in-finally` reads it.
        try {
            return setitem(obj, key, value, ...rest);
        } finally {
            if (MARKS.has(obj)) {
                // `d["rows"] = rows` puts rows under watch too, and so does the
                // key: the initial walk hands the watch to both halves of an
                // entry, and an insertion has to keep that invariant rather
                // than restate half of it. `d[Box()] = "label"` after the watch
                // began left the key outside it, and mutating it repainted
                // nothing.
                stored(obj, key, value);
                MARKS.get(obj)();
            }
        }
    };

    // The ways into a watched container are the ones we know about; reading a
    // child is the last moment before it could be mutated, so the watch is
    // handed over here too, for whatever got in another way. An unwatched
    // container pays one property miss and nothing else.
    const getitem = $B.$getitem;
    $B.$getitem = function (obj, ...rest) {
        const result = getitem(obj, ...rest);
        if (MARKS.has(obj)) inherit(obj, result);
        return result;
    };

    const delitem = $B.$delitem;
    $B.$delitem = function (obj, ...rest) {
        // In a `finally`, like the write above it and the deleter below: a
        // `__delitem__` of the author's may remove the entry and then raise,
        // and nothing puts it back.
        try {
            return delitem(obj, ...rest);
        } finally {
            notify(obj);
        }
    };

    // What a write left behind, asked of the object rather than of the name it
    // was given.
    //
    // A `__setattr__` may normalise its value, `object.__setattr__(self, name,
    // list(value))`, or store it under a name of its own, `self._rows` for a
    // written `rows`, the ordinary private-field spelling. So the object is asked
    // what it holds now, not for one name.
    //
    // Three steps, and each answers something the others cannot. `adopt` links
    // the storage in one hop and scans the slots, which is the same walk `mark`
    // does. That link alone is not enough: a storage dictionary walks its own
    // entries when it is *first* marked, so a second write into it reaches
    // nobody; hence the walk of the storage itself. And the value that came in
    // stays linked, because an object may keep it somewhere neither of the two
    // can see.
    //
    // All of it is idempotent: `inherit` keeps one parent per child and `mark`
    // is a WeakMap lookup away. It runs only for an object under watch, which is
    // the guard the caller already holds.
    const rewalk = (obj, value, name) => {
        adopt(obj);

        const attributes = ownAttributes(obj);

        if (MARKS.has(attributes)) {
            adopt(attributes);
        }

        inherit(obj, value, undefined, true, name);
    };

    // `box.value = 1` and `del box.value`. Brython compiles an attribute write
    // through one of two entry points depending on the statement, and both have
    // to be covered or the rule would hold only half the time.
    for (const name of ['$setattr', '$setattr1']) {
        const setattr = $B[name];
        $B[name] = function (obj, attr, value, ...rest) {
            // In a `finally`, like every other mutation path: an author's
            // `__setattr__` may write the attribute and *then* raise, and the
            // exception does not undo the write. `object.__setattr__(self,
            // name, value)` followed by a `raise` left the model at 1 and the
            // page at 0, with the handler catching the error and carrying on.
            let result;

            try {
                result = setattr(obj, attr, value, ...rest);
                return result;
            } finally {
                classNameChanged(obj, attr);

                if (MARKS.has(obj)) {
                    // What the write *stored*, and not only what it was handed:
                    // a `__setattr__` of the author's may normalise, copy or wrap
                    // its argument, `object.__setattr__(self, name, list(value))`
                    // being an ordinary way to defend an invariant, and the list
                    // the object holds is the one the page reads.
                    //
                    // Read off the instance's own storage, never through
                    // `$getattr`: a property of the author's must not run
                    // because something was written.
                    rewalk(obj, value, attr);
                    MARKS.get(obj)();
                }
            }
        };
    }

    // A slot written or deleted through its descriptor: `Box.rows.__set__(box,
    // [1])` and `Box.rows.__delete__(box)` reach the member descriptor without
    // `$setattr` or `$delattr`, and the descriptor writes the instance's storage
    // itself. The instance is the descriptor's first argument, not the object
    // the method is read from.
    //
    // Brython builds the two methods once (`make_set_del`), so each is wrapped
    // here as Brython built it, its answer kept, around a notification.
    // `tp_descr_set` itself is left alone: an ordinary `box.rows = [1]` reaches
    // it from `$setattr`, which already answers.
    const member = $B.member_descriptor;

    for (const name of ['__set__', '__delete__']) {
        const built = $B.search_in_dict(member, name, $B.NULL).wrapped;

        $B.set_to_dict(
            member,
            name,
            $B.wrapper_descriptor.$factory(member, name, (self, obj, ...value) => {
                try {
                    return built(self, obj, ...value);
                } finally {
                    if (MARKS.has(obj)) {
                        if (value.length > 0) rewalk(obj, value[0]);
                        MARKS.get(obj)();
                    }
                }
            })
        );
    }

    // The builtin `delattr`, which `del box.value` reaches too: the statement's
    // entry point, `$B.$delattr`, calls it by name at each call, so the one
    // wrapper answers both. Wrapping the statement's alone left `delattr(box,
    // "value")` repainting nothing. The wrapper carries the builtin's own
    // properties, its name and its signature.
    const delattr = $B.builtins.delattr;
    $B.builtins.delattr = function (obj, attr) {
        // In a `finally`, like the write beside it: a `__delattr__` of the
        // author's may remove the attribute and *then* raise, and the exception
        // does not put it back. The page showed `True` for a `hasattr` the model
        // answered `False` to.
        try {
            return Reflect.apply(delattr, this, arguments);
        } finally {
            classNameChanged(obj, attr);
            notify(obj);
        }
    };

    Object.defineProperties($B.builtins.delattr, Object.getOwnPropertyDescriptors(delattr));

    // `row += [1]`, `d |= other`, and every other operator with an `=` after
    // it: Brython compiles them all through here. They mutate the object and
    // rebind the name to that same object, so a watched container can change
    // without a single watched name being written.
    //
    // Giving back a *different* object is a rebinding, not a mutation, and the
    // accessor of whatever name it lands on already answers for that. `n += 1`
    // is the case this tells apart.
    const augmAssign = $B.augm_assign;
    $B.augm_assign = function (left, op, right, ...rest) {
        const watched = MARKS.has(left);
        let result;

        // An exception is not proof that nothing changed. `d |= values()` keeps
        // the entries the generator yielded before it raised, and the operator
        // never returns: the identity test below never runs, the assignment that
        // would have rebound the name never happens, and nothing downstream
        // makes up for the missing notification. The method paths take the same
        // shape, so `d.update(values())` and `d |= values()` answer alike.
        //
        // `adopt` rather than `inherit(left, right)` here: what landed inside
        // came out of an iterator nobody can see, so the container is asked what
        // it now holds. Notifying a container that turned out not to have
        // changed costs a render; not notifying one that did costs the page.
        try {
            result = augmAssign(left, op, right, ...rest);
        } catch (error) {
            if (watched) {
                adopt(left);
                MARKS.get(left)();
            }

            throw error;
        }

        if (result === left && watched) {
            // `rows += [[]]` puts the new rows under watch, and `rows +=
            // items()` cannot: the generator kept nothing, and neither does a
            // class whose `__iter__` makes its rows as it goes. The same two answers
            // as the method paths above, and the same question decides.
            if (!keeps(right) || !inheritContents(left, right)) adopt(left);

            MARKS.get(left)();
        }

        return result;
    };
}

installMutationTracking(globalThis.__BRYTHON__);

// A Python function, which keeps its attributes in a dictionary as an instance
// does, and may hold state there as one does: `counter.count += 1`. A function
// of JavaScript's is `JSFunction` to Brython, and not ours to watch.
const pyFunction = (value) => typeof value === 'function' && quietPyType(value) === globalThis.__BRYTHON__.function;

// What a watch may reach: an object, or a Python function.
const watchable = (value) => value !== null && (typeof value === 'object' || pyFunction(value));

// Only a container can be mutated in place; a scalar propagates by rebinding,
// which the accessor already handles.
function mutable(value) {
    if (pyFunction(value)) return true;
    if (value === null || value === undefined || typeof value !== 'object') return false;
    if (Array.isArray(value)) return true; // list, and a tuple is one too
    if (value === NONE) return false; // a singleton shared by the whole program

    try {
        const $B = globalThis.__BRYTHON__;
        const cls = $B.get_class(value);
        // A class is data when the author wrote it: it keeps its attributes in
        // a dictionary, as a function and an instance do, and `Counter.total +=
        // 1` is state. CPython flags such a class a heap type, and so does
        // Brython; the engine's own classes have nothing to watch.
        if (cls === _b_.type) return (value.tp_flags & $B.TPFLAGS.HEAPTYPE) !== 0;

        // A bound method, made anew by each read, holds nothing of its own:
        // what changes is its function or its instance, each watched as itself.
        return cls !== undefined && cls !== $B.method;
    } catch {
        return false; // a foreign JavaScript value is not ours to mark
    }
}

// The mutators whose arguments are **sources**: what lands is what iterating
// them yields, not the argument itself.
const SOURCES = new Set([
    '__init__', '__iadd__', '__ior__', '__iand__', '__isub__', '__ixor__',
    'extend', 'extendleft', 'update', 'intersection_update',
    'difference_update', 'symmetric_difference_update'
]);

// A source that still holds what it yielded: a list, a tuple, a dict, a set or
// a frozenset, of exactly that class.
//
// `rows.append(child)` is given the very thing that lands, so the watch goes to
// the argument and the link is one assignment. `rows.extend(other)` is given a
// **source**, and the link to it holds only if the children it yielded are
// still inside it. A generator yields and forgets, and a class whose `__iter__`
// makes a fresh row on each pass never held one: the children are inside the
// container and nothing that is watched points at them, so the page goes on
// showing `[[]]` while Python holds `[[1]]`.
//
// Telling the two apart is what decides between the cheap link and the walk, and
// the walk cannot be the answer for both: a thousand-row list would pay for its
// whole length on every `extend([row])`.
//
// Only the builtin containers are known to keep what they yield, and a subclass
// may override `__iter__`, so the class is compared exactly. Everything else
// makes the container say what it now holds; the source is never iterated
// again, since a second pass may make other objects or run other effects. A
// value that is not an object holds no container to watch.
function keeps(value) {
    if (value === null || typeof value !== 'object') return true;

    const $B = globalThis.__BRYTHON__;

    // Keyword arguments, carried under `$B.KW`: the explicit ones in an object
    // of their own, which holds what landed, then each `**` mapping as itself.
    const keywords = value[$B.KW];
    if (Array.isArray(keywords)) return keywords.slice(1).every(keeps);

    try {
        const cls = $B.get_class(value);
        return cls === _b_.list || cls === _b_.tuple || cls === _b_.dict
            || cls === _b_.set || cls === _b_.frozenset;
    } catch {
        return false; // a foreign JavaScript value: the container is asked instead
    }
}

// Attach a marker to the value stored under a module-level name: `bump` says it
// moved, `read` subscribes whoever is asking to the signal that says so. One
// object may be bound to two names; both are then told, and both watched.
//
// The pair is what makes the reactivity a property of the *object* rather than
// of the place it was declared: duck typing, applied to change notification.
// Anything holding the value can subscribe to it just by handing it through.

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
const pyType = (value) => (value !== null && typeof value === 'object' ? quietPyType(value) : undefined);

// What an object holds under a name, read off the descriptors along its chain
// without running a getter: undefined for an accessor, which the serialiser
// alone reads, at its turn.
const quietly = (value, name) => {
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
const quietPyType = (value) => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined;

    const type = ownType(value) ?? quietly(value, globalThis.__BRYTHON__.OB_TYPE);

    return pyClass(type) ? type : undefined;
};

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
const javascriptOwn = (value) => quietPyType(value) === undefined;

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
function ownAttributes(value) {
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
function authoredInstance(value) {
    const type = ownType(value);

    if (!pyClass(type)) return false;
    if (Array.isArray(type.tp_mro) && type.tp_mro.some((one) => one !== _b_.object && _b_[one.tp_name] === one)) {
        return false;
    }

    const attributes = ownAttributes(value);

    return (attributes !== null && typeof attributes === 'object') || declaresSlots(value);
}

// A watch runs from the object that was named to every container under it, and
// a mutation anywhere under a name has to reach whoever is reading that name.
//
// The link points *up*: a child holds its parents, and notifying walks from the
// mutated object towards the names. Held the other way, the parent's
// subscribers copied down into each child, a subscriber could not sign off,
// its callback in every copy, and one arriving after a child was handed the
// watch would land in the parent's list alone, out of that child's reach.
//
// `stamp` is what stops a cycle. `a.append(a)` is a graph, not a tree, and the
// walk marks each marker with the number of the walk it is in.
let walked = 0;

// How many times a watched container has changed, program-wide: the value a
// marker's `stamp` takes when its own container does.
let changes = 0;

//
// A link is checked as the walk crosses it. A child taken out of a list, a dict
// or a set, or out of a subclass of one, no longer belongs to it, and the link
// goes: `rows.clear()` then `child.append(1)` would otherwise re-run what reads
// `rows`. An instance keeps its links, since what it hands out may live on its
// class or behind a property, and so does a subclass for what it holds that
// way (`holds`).
//
// Climbed with a stack of its own rather than by recursion, for the reason
// `adopt` gives: a mutation at the tail of a long chain climbs every link of it.
const upwards = (start, stamp, key) => {
    if (start.seen === stamp) return;
    start.seen = stamp;

    for (const one of start[key]) one();

    if (start.parents === undefined) return;

    // One frame per marker being climbed from: the parent it is at, counting
    // down, and the one it climbed into last, which is checked on the way back.
    const frames = [climbing(start)];

    while (frames.length > 0) {
        const frame = frames[frames.length - 1];
        const { marker, child, verified } = frame;
        const parents = marker.parents;

        // A parent nobody listens to and that leads nowhere is a dead end: the
        // container of a component that is gone. Its link goes, or every
        // mutation of shared data would visit one per mount the session has
        // seen. `track` links a container's children again if it is ever
        // subscribed to anew.
        if (frame.climbed !== null) {
            if (dead(frame.climbed)) {
                marker.linked.delete(frame.climbed);
                parents.splice(frame.at, 1);
            }
            frame.climbed = null;
        }

        if (--frame.at < 0) {
            frames.pop();
            continue;
        }

        const parent = parents[frame.at];
        const holder = parent.target.deref();
        const known = verified.get(parent) === parent.stamp;

        if (holder === undefined || (child !== undefined && !known && !holds(holder, child, marker))) {
            marker.linked.delete(parent);
            parents.splice(frame.at, 1);
            continue;
        }

        verified.set(parent, parent.stamp);
        frame.climbed = parent;

        if (parent.seen === stamp) continue;
        parent.seen = stamp;

        for (const one of parent[key]) one();

        if (parent.parents !== undefined) frames.push(climbing(parent));
    }
};

// A link found to hold stays found until its parent changes: a dict of rows
// whose rows are each updated would otherwise read every entry of the dict once
// per row.
const climbing = (marker) => ({
    marker,
    child: marker.target.deref(),
    verified: (marker.verified ??= new WeakMap()),
    at: marker.parents.length,
    climbed: null
});

const dead = (marker) =>
    marker.bumps.length === 0 &&
    marker.reads.length === 0 &&
    (marker.parents === undefined || marker.parents.length === 0);

// An item written, `obj[key] = value`: both halves are inside. Except a slice,
// `rows[:] = [child]`, whose value is a source: what it yields is inside.
function stored(obj, key, value) {
    let slice = false;
    try {
        slice = globalThis.__BRYTHON__.get_class(key) === _b_.slice;
    } catch {
        /* a foreign key is not a slice */
    }

    if (!slice) {
        inherit(obj, key);
        // A negative index names a slot from the end, and the slot is what
        // `holds` reads.
        inherit(obj, value, Array.isArray(obj) && typeof key === 'number' && key < 0 ? key + obj.length : key);
    } else {
        if (!keeps(value) || !inheritContents(obj, value)) adopt(obj);

        indexed(obj, 0);
    }
}

// Whether `holder` still holds `child`, asked of a list, a dict or a set, whose
// storage says it without running anything of the author's, and of a subclass
// of one. A subclass is an object with attributes too, so a link it made through
// an attribute (`loose`, which `inherit` keeps) holds as an instance's does, and
// so does every link of a class that redefines how an item gets in or out,
// which may keep it anywhere. Any other link is checked against the storage,
// and the storage is asked first, being the common answer and the cheap one.
function holds(holder, child, marker) {
    let cls;
    try {
        cls = globalThis.__BRYTHON__.get_class(holder);
    } catch {
        return true;
    }

    const base = storedAs(cls);

    if (base === undefined) return attributeHolds(holder, child, marker);
    if (stores(base, holder, child, marker)) return true;

    // Read off an attribute of a subclass, `rows.label` of `class Row(list)`:
    // the name is asked, as an instance's is.
    if (base !== cls && marker.names?.has(holder)) return attributeHolds(holder, child, marker);

    return base !== cls && (marker.loose?.has(holder) === true || redefinesItems(cls));
}

// Whether an object, an instance or a class, still holds what was read off it
// under a name, `box.rows` or `Shelf.rows`: one of those names still finds it.
// `Shelf.rows = [1]`, `del Shelf.rows`, a slot written again, or a new value on
// the class an instance reads it from, and the old list no longer wakes what
// reads the name. A link made with no name is kept.
function attributeHolds(holder, child, marker) {
    const names = marker.names?.get(holder);

    if (names === undefined) return true;

    for (const name of names) {
        const found = attributeOf(holder, name);

        if (found === UNTOLD || found === child) return true;
    }

    return false;
}

// What Python's lookup of `name` on `holder` finds, in Python's order and read
// as data so that nothing of the author's runs: a data descriptor of its type
// first, a slot read off its storage; then its own names, an instance's
// dictionary or a class's MRO; then what its type holds. MISSING when nothing
// binds the name. UNTOLD when only the author's code could say, a property, a
// descriptor's `__get__`, a `__getattr__` or a `__getattribute__`, or when the
// holder keeps its own names elsewhere.
const UNTOLD = Symbol('untold');

function attributeOf(holder, name) {
    const $B = globalThis.__BRYTHON__;
    const kind = quietPyType(holder);

    if (!pyClass(kind)) return UNTOLD;

    const asks = (hook) =>
        kind.tp_mro.some((one) => (one.tp_flags & $B.TPFLAGS.HEAPTYPE) !== 0 && $B.search_in_dict(one, hook, $B.NULL) !== $B.NULL);

    if (asks('__getattr__') || asks('__getattribute__')) return UNTOLD;

    const has = (value, slot) => $B.search_slot($B.get_class(value), slot, $B.NULL) !== $B.NULL;
    const described = declares(kind, name);

    if (described !== $B.NULL && has(described, 'tp_descr_set')) {
        if (pyClass(holder) || $B.get_class(described) !== $B.member_descriptor) return UNTOLD;

        const slot = slotValues(holder, false, name);

        return slot.has(name) ? slot.get(name) : MISSING;
    }

    const own = ownAttributes(holder);
    const dictionary = own !== null && typeof own === 'object';

    if (pyClass(holder)) {
        const found = declares(holder, name);

        if (found !== $B.NULL) return has(found, 'tp_descr_get') ? UNTOLD : found;
    } else if (dictionary && Object.hasOwn(own, name)) {
        return own[name];
    }

    if (described !== $B.NULL) return has(described, 'tp_descr_get') ? UNTOLD : described;

    return pyClass(holder) || dictionary ? MISSING : UNTOLD;
}

// Whether the storage of a list, a dict or a set holds `child`.
//
// For a dict, the key the child entered under is read first when there is one
// and it is a string or a number, whose hash runs no code of the author's: one
// entry read, where every entry was, once per mutation of every row.
function stores(base, holder, child, marker) {
    const key = marker.keys?.get(holder);

    // For a list, the index `indexed` keeps. A list changed where no mutator
    // was seen is searched, once: the index found is kept for the next check.
    if (base === _b_.list) {
        if (typeof key === 'number' && holder[key] === child) return true;

        const at = holder.indexOf(child);

        if (at !== -1) (marker.keys ??= new WeakMap()).set(holder, at);

        return at !== -1;
    }

    // Read off the dict's own table, so a subclass's `__getitem__` and
    // `__missing__` are not run by the asking.
    if (base === _b_.dict) {
        if (plainKey(key)) {
            try {
                if (_b_.dict.$getitem(holder, key, true) === child) return true;
            } catch {
                /* no such key any more: the full read below says where it went */
            }
        }

        for (const [one, value] of heldEntries(holder)) if (one === child || value === child) return true;
        return false;
    }

    // For a set, the bucket it was found in: the hash it is stored under, which
    // the set keeps as a key of its store.
    if (typeof key === 'string' && holder.$store[key]?.includes(child)) return true;

    for (const bucket of Object.values(holder.$store)) if (bucket.includes(child)) return true;
    return false;
}

// Which of the three a class keeps its items as: itself, or the one a subclass
// descends from, read off its MRO.
const storedAs = (cls) => {
    if (cls === _b_.list || cls === _b_.dict || cls === _b_.set) return cls;

    const mro = cls?.tp_mro;

    return Array.isArray(mro) ? [_b_.list, _b_.dict, _b_.set].find((one) => mro.includes(one)) : undefined;
};

// The methods by which an item gets into a container or is handed out of it.
// Construction and the attribute protocol are not among them: an `__init__` of
// the author's fills the storage or an attribute, and an attribute's link is
// kept by itself.
const ITEM_METHODS = [...FOLLOWED, '__getitem__', '__iter__'].filter(
    (name) => !['__init__', '__setattr__', '__delattr__'].includes(name)
);

// Whether a class of the author's along the MRO defines one of them, read from
// the class dictionaries, as `declares` reads them.
const redefinesItems = (cls) => {
    const $B = globalThis.__BRYTHON__;

    return cls.tp_mro.some(
        (one) => _b_[one.tp_name] !== one && ITEM_METHODS.some((name) => $B.search_in_dict(one, name, $B.NULL) !== $B.NULL)
    );
};

// The index each watched child of a list sits at, from `from` to the end, kept
// on its link so that `holds` reads one slot: without it, a child would be
// searched for at its next mutation, a whole list per row updated. So the
// rows an `append`, an `extend` or a `+=` add are indexed where they land, at
// the end, and a mutation that moves the others indexes the list again, at a
// cost no larger than its own.
function indexed(list, from) {
    if (!Array.isArray(list) || storedAs(ownType(list)) !== _b_.list) return;

    for (let i = Math.max(0, from); i < list.length; i++) {
        const own = MARKS.get(list[i]);

        if (own !== undefined) (own.keys ??= new WeakMap()).set(list, i);
    }
}

// Mutations of a list after which its children may sit elsewhere. `pop()`
// without an index takes the last one and moves nothing.
const SHIFTS = new Set(['insert', 'remove', 'pop', 'sort', 'reverse', '__delitem__']);

// A key whose hash runs no code of the author's: a string, a number, a bool,
// or a tuple of them, which is how a grid is keyed, `cells[(row, col)]`.
const plainKey = (key) =>
    typeof key === 'string' ||
    typeof key === 'number' ||
    typeof key === 'boolean' ||
    (Array.isArray(key) && globalThis.__BRYTHON__.get_class(key) === _b_.tuple && key.every(plainKey));

// What a builtin container yields, handed to `into` one by one: the source of
// `rows.extend(other)` is not inside `rows`, what it held is. A dict fed pairs,
// `d.update([("k", child)])` or `d.update({("k", child)})`, holds each key and
// each value, not the pair.
//
// A pair is split by its storage only when it is exactly a tuple or a list,
// whose storage is what Python consumed. Any other pair said through its own
// `__iter__` what it gave, which running again could change; the answer is
// false then, and the caller asks the container what it now holds.
function inheritContents(into, source) {
    const $B = globalThis.__BRYTHON__;
    const pairs = $B.is_dict(into);
    let whole = true;
    let given = 0;
    const take = (child) => {
        given++;

        if (!pairs) {
            inherit(into, child);
        } else if (Array.isArray(child) && child.length === 2 && [_b_.tuple, _b_.list].includes($B.get_class(child))) {
            inherit(into, child[0]);
            inherit(into, child[1], child[0]);
        } else {
            whole = false;
        }
    };

    if (Array.isArray(source?.[$B.KW])) {
        // `update(key=row)` and `update(**rows)`: each keyword is an entry, the
        // explicit ones read off their object and each `**` mapping off its own
        // entries. A reading of the target's every entry per call, which is
        // what the walk would do, made filling a table one keyword at a time
        // quadratic.
        const [named, ...mappings] = source[$B.KW];

        for (const [key, child] of [...Object.entries(named), ...mappings.flatMap((one) => pyEntries(one))]) {
            given++;
            inherit(into, key);
            inherit(into, child, key);
        }
    } else if (Array.isArray(source)) {
        for (const child of source) take(child);
    } else if (globalThis.__BRYTHON__.is_dict(source)) {
        for (const [key, child] of pyEntries(source)) {
            given++;
            inherit(into, key);
            inherit(into, child, key);
        }
    } else if (isSet(source)) {
        // A value hashes the same in every set, so a set fed from a set keeps
        // each child's bucket.
        for (const [hash, bucket] of Object.entries(source.$store)) {
            for (const child of bucket) {
                if (isSet(into)) inherit(into, child, hash);
                else take(child);
            }
        }
    }

    // What a list was given lands at its end: `extend`, `+=`, and `__init__`,
    // whose end is the whole list.
    indexed(into, into.length - given);

    return whole;
}

// Where a watched container's marker lives.
//
// Not a property on the container itself: **a Brython dict exposes its keys as
// ordinary properties**, so a business key of that spelling would meet the
// mechanism, on data Python is entitled to hold and an API may well send.
//
// Not a symbol either: an own symbol key makes an object unusable as a WebIDL
// record, which is what `new Response(body, {headers})` takes. Brython keeps its
// own back-reference in a WeakMap for the same reason.
//
// And a key held outside the object needs no guard for a frozen object, nor for
// `Storage` turning a property into its own source text.
const MARKS = new WeakMap();

// The marker of a watched container, and the one export in this file that exists
// for a test. Counting the subscribers of a shared list is the measurement the
// leak tests are built on, and the marker is not a property anyone can
// reach; naming the door here is what keeps that measurement possible, and the
// rule the project already follows for an internal it depends on: when the code
// reads a name, a test names it too.
export const marks = (value) => MARKS.get(value);

// The slots of an instance, read through their member descriptors, each from
// the storage it names (`d_member.attr`), so a slot a subclass redeclares is
// its own: by name, the first descriptor of a name along the MRO, as `box.x`
// reads it, for the slots that hold a value; with `all`, every value stored,
// a shadowed slot's too; with `only`, that one name, looked up in each class
// rather than read off all its entries, since a view asks it once per key.
// The one reader of a slot's storage.
function slotValues(value, all = false, only = null) {
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
const declares = (cls, name) => {
    const $B = globalThis.__BRYTHON__;

    for (const one of Array.isArray(cls.tp_mro) ? cls.tp_mro : [cls]) {
        const found = $B.search_in_dict(one, name, $B.NULL);

        if (found !== $B.NULL) return found;
    }

    return $B.NULL;
};

// A text signature that declares no positional parameter but the receiver:
// `($self, /, *, key=None, reverse=False)`, `list.sort`'s.
const NO_POSITIONAL = /^\(\$self(?:,\s*\/)?(?:,\s*\*\s*(?:,.*)?)?\)$/s;

// Whether a builtin bound to its receiver takes no positional argument but the
// receiver, which is all JavaScript can pass: `rows.clear`, which `list` lists
// in `noargs_methods`, the way CPython flags it `METH_NOARGS`, or `rows.sort`,
// whose `__text_signature__` has keywords only. For the list, the class of the
// MRO whose dictionary holds the name answers, so a subclass that rebinds the
// name answers for itself.
const takesNoPositional = (value) => {
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
const declaresSlots = (value) => {
    const $B = globalThis.__BRYTHON__;

    const type = pyType(value);

    if (type === undefined) return false;

    return declares(type, '__slots__') !== $B.NULL;
};

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
const mutableBytes = (value) => ownType(value).tp_mro.includes(_b_.bytearray);

// The bytes each copy was made of, for the way back (`bytesIn`).
const BYTES_OF = new WeakMap();

const bytesOut = (value) => {
    const out = Uint8Array.from(value.source);

    BYTES_OF.set(out, value);
    if (!mutableBytes(value)) globalThis.__BRYTHON__.PYOBJ_MAP.set(out, value);

    return out;
};

// A copy of bytes handed back to Python: the object it was made of while the
// two hold the same bytes, and a new one of the same kind, bytes or a
// `bytearray`, of what the copy holds once either moved on: JavaScript writes
// into a `Uint8Array`, and Python appends to a `bytearray`. Undefined for any
// other value. The engine's own lookup (`PYOBJ_MAP`) follows the newest bytes.
const bytesIn = (value) => {
    const original = BYTES_OF.get(value);

    if (original === undefined) return undefined;

    const held = original.source;

    if (held.length === value.length && held.every((one, at) => one === value[at])) return original;

    const mutable = mutableBytes(original);
    const fresh = (mutable ? _b_.bytearray : _b_.bytes).$factory(globalThis.__BRYTHON__.$list(Array.from(value)));

    BYTES_OF.set(value, fresh);
    if (!mutable) globalThis.__BRYTHON__.PYOBJ_MAP.set(value, fresh);

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

function mark(value) {
    // `stamp` moves each time the container itself changes, which is what
    // `upwards` needs to know whether a link it checked is still to check.
    //
    // `change` is the call that changed it, its name, arguments and result,
    // when the caller knows them: what a walk of a set in flight reads
    // (`SetView`), each walk held weakly, so one left suspended goes when its
    // iterator does.
    const marker = (...change) => {
        marker.stamp = ++changes;

        for (const ref of marker.walks ?? []) {
            const walk = ref.deref();

            if (walk === undefined) marker.walks.delete(ref);
            else walk.changed(...change);
        }

        upwards(marker, ++walked, 'bumps');
    };

    marker.stamp = 0;

    marker.bumps = [];
    marker.reads = [];
    marker.follow = () => upwards(marker, ++walked, 'reads');
    // Weak, so a child's link does not keep a container it has left alive.
    marker.target = new WeakRef(value);

    MARKS.set(value, marker);

    adopt(value);

    return marker;
}

// Everything already inside a watched value: an attribute written in __init__,
// an element of a list, a key or a value of a dict. When a watch begins, none of
// them has been handed anything, and `inherit` marks in turn, so depth follows
// on its own and a cycle stops at the first object that already carries a
// marker.
//
// Taking the whole graph in hand at that moment is what lets every way of
// *reading* a child go unwatched: the child is marked before Python can reach
// for it, by any route.
//
// Called again after a mutation that raised, where the same question arises for
// the same reason: children may have landed inside without anything handing
// them the watch.
//
// A queue and not a recursion: `mark` → `adopt` → `inherit` → `mark` took three
// frames of stack per object, so a linked list of two thousand nodes, the kind a
// loop builds, overflowed it where Python walks it without a limit. A value met
// while the queue drains waits its turn, and the outermost call returns once
// the whole graph is in hand, as it did.
const unadopted = [];
let adopting = false;

function adopt(value) {
    unadopted.push(value);

    if (adopting) return;

    adopting = true;

    try {
        while (unadopted.length > 0) adoptOne(unadopted.pop());
    } finally {
        adopting = false;
        unadopted.length = 0;
    }
}

function adoptOne(value) {
    const attributes = ownAttributes(value);
    if (attributes !== undefined) {
        // The storage itself, and not only what it holds. Setting an attribute
        // usually goes through something this file intercepts (`$setattr` for
        // `box.value = 1`, and the `$getattr` that hands the watch to what it
        // returns for `box.__dict__[...]`), but `vars(box)` asks the engine for
        // the dictionary with `get_dict` and writes straight into it. The values
        // were children of the instance and the container that holds them was
        // not, so that write reached nobody.
        //
        // One link and not two: marking the storage walks it in turn, so each
        // attribute becomes a child of the dictionary rather than of the
        // instance, and the chain carries a mutation up all the same. Listing
        // the values here as well would give every one of them two routes
        // upward and two parents to retain, in a structure that already keeps
        // its links pointing up. What holds the chain is that the storage is a
        // dict to `adopt`, and `tests/first-instance.test.js` is the test that
        // fails if it ever stops being one: nothing there re-reads the
        // attribute, so the initial walk is the only route.
        inherit(value, attributes, undefined, true);
    }

    // An instance is not its `__dict__`. A class declaring `__slots__` has no
    // per-instance dict at all, and Brython's member descriptor keeps each slot
    // as an own property of the object, the one its `d_member.attr` names. So
    // the walk above found nothing, and `box.rows.append(1)` changed the list
    // while the page kept the old count.
    //
    // Read off the object through the descriptors (`slotValues`), every value
    // stored, a slot a subclass redeclares among them: an uninitialised slot
    // has no property and is skipped, and nothing goes through `$getattr`, so
    // no property getter of the author's is run by the act of watching.
    for (const one of slotValues(value, true)) inherit(value, one, undefined, true);

    // Only what Python calls a container, and that bound is the whole point:
    // walking any object's keys would let the watch leave the author's data, as
    // far as `__BRYTHON__` itself and `localStorage`.
    //
    // A set is walked too. **Hashable and immutable are two properties**: a
    // user class is hashable by default and its attributes are mutable, so
    // `{Box()}` holds exactly what this walk exists for.
    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) inherit(value, value[i], i);
    } else if (globalThis.__BRYTHON__.is_dict(value)) {
        // Asked of Python, not of the properties. A dict keeps its string keys
        // as ordinary properties and everything else in a hash table, so a walk
        // over the properties reached the children of `{"one": []}` and not
        // those of `{1: []}`: the same mutation notified in one and was silent
        // in the other, and a table indexed by id kept showing an old page.
        //
        // Asked as `is_dict` and not as an equality against `dict`, which is the
        // same question the converter asks a page later: `class Mapping(dict):
        // pass` is an ordinary way to name a domain type, and an equality said
        // no, so neither its keys nor its values were taken under watch.
        //
        // Both halves of an entry. A key is a child of the dict as much as a
        // value is: hashable is not immutable, so `{Box(): "label"}` holds an
        // object whose attributes change under a watch that never reached it.
        // `inherit` steps over a string or a number on its own, so this costs
        // nothing on the dicts that have ordinary keys.
        for (const [key, child] of heldEntries(value)) {
            inherit(value, key);
            inherit(value, child, key);
        }
    } else if (isSet(value)) {
        // `$store` maps a hash to the bucket of members that share it, which is
        // the set's own layout, read the way the dict above is read rather than
        // through `__iter__`: an iteration goes back through `$getattr`, which
        // this file intercepts, and the walk would re-enter itself.
        //
        // A frozenset is here too. What it freezes is the membership, not the
        // members, and a `Box()` inside one is as mutable as anywhere else.
        for (const [hash, bucket] of Object.entries(value.$store)) {
            for (const child of bucket) inherit(value, child, hash);
        }
    } else if (viewed(value) !== undefined) {
        // `keys()`, `values()`, `items()`, the read-only `mappingproxy` a view
        // hands out as `.mapping` and a `memoryview` are live: they hold
        // nothing of their own, only what they read. So that is the view's
        // child, and what changes it reaches what reads the view, as it
        // reaches what reads it.
        inherit(value, viewed(value));
    }
}

// What a live view reads, or undefined: the three views of a dict, which
// Python offers no way to subclass, keep it as `dict_obj`; a `mappingproxy`
// keeps it as `mapping`, and is followed only when that is a dict, the class
// dictionary behind a `type.__dict__` being no data of the author's; a
// `memoryview` keeps its buffer as `obj`, a `bytearray` changing under it.
const viewed = (value) => {
    const $B = globalThis.__BRYTHON__;
    const type = ownType(value);

    if (type === $B.dict_keys || type === $B.dict_values || type === $B.dict_items) return value.dict_obj;
    if (type === $B.mappingproxy && $B.is_dict(value.mapping)) return value.mapping;
    if (type === _b_.memoryview) return value.obj;

    return undefined;
};

// Sign one subscriber onto one marker, and tell `owner` about it so the same
// subscriber can sign off. `owner` is the component's list; a store has none,
// since its subscription lives as long as the module does.
const join = (marker, bump, read, owner) => {
    if (marker.bumps.includes(bump)) return;

    marker.bumps.push(bump);
    marker.reads.push(read);

    if (owner !== undefined) owner.push(marker, bump);
};

// Sign the same subscriber off one marker: a name rebound no longer reads what
// it held. Other names on that object keep their own subscribers.
const leave = (marker, bump, owner) => {
    const at = marker.bumps.indexOf(bump);
    if (at === -1) return;

    marker.bumps.splice(at, 1);
    marker.reads.splice(at, 1);

    if (owner === undefined) return;

    for (let i = 0; i < owner.length; i += 2) {
        if (owner[i] === marker && owner[i + 1] === bump) {
            owner.splice(i, 2);
            return;
        }
    }
};

// What the name held before this write loses its subscription, or a mutation of
// a value the name no longer holds would still notify it. Kept on the name's
// `bump` rather than read off the name: that is a signal, and reading it inside
// an effect that writes the name would subscribe the effect to it.
export function track(value, bump, read, owner) {
    const previous = bump.held;
    bump.held = value;

    if (previous !== value && watchable(previous)) {
        const old = MARKS.get(previous);
        if (old !== undefined) leave(old, bump, owner);
    }

    if (!watchable(value)) return value;

    // Cheapest path first: a value already watched is the common case, and it
    // must not pay a type classification on every write.
    const own = MARKS.get(value);
    if (own !== undefined) {
        // A container with nobody listening may have lost the links from its
        // children, pruned as a dead end: listened to again, it takes them back.
        const revived = dead(own);
        join(own, bump, read, owner);
        if (revived) adopt(value);
        return value;
    }

    if (!mutable(value)) return value;

    // A frozen object refuses the marker and comes back without one.
    const marker = mark(value);

    if (marker !== undefined) join(marker, bump, read, owner);

    return value;
}

// Every marker a component signed onto, and the callback it signed with, kept
// flat rather than in pairs so that subscribing allocates nothing.
//
// Without this, a container shared through a store would keep the callbacks of
// every component that ever read it, one more per mount of a child, for one
// child alive.
export function unsubscribe(owner) {
    for (let i = 0; i < owner.length; i += 2) {
        const marker = owner[i];
        const at = marker.bumps.indexOf(owner[i + 1]);

        if (at !== -1) {
            marker.bumps.splice(at, 1);
            marker.reads.splice(at, 1);
        }
    }

    owner.length = 0;
}

// A container read out of a watched one comes under the same watch. This is
// what deep proxying buys Svelte, done lazily and without a single proxy: the
// child is marked the first time Python reaches for it, which is necessarily
// just before it could be mutated.
// `key` is the key a dict holds `child` under, when the caller knows it: the
// link is then checked by reading that one entry rather than every entry.
// `loose` says the link was made through an attribute, which no storage of the
// parent's can confirm, so `holds` keeps it.
const SWEEP_FROM = 8;

function inherit(parent, child, key, loose = false, name = undefined) {
    return linked(MARKS.get(parent), parent, child, key, loose, name);
}

// The same, under a marker given rather than read off `parent`: the one that
// stands for a name of a class, which carries no marker of its own. `name` is
// the attribute the child was read under, which `holds` asks again.
function linked(marker, parent, child, key, loose, name) {
    if (!watchable(child)) return child;

    let own = MARKS.get(child);
    let revived = false;

    if (own === undefined) {
        if (!mutable(child)) return child;
        own = mark(child);

        // A frozen object refuses the marker, and `mark` says so by giving the
        // value back unchanged.
        if (own === undefined) return child;
    } else {
        // A dead end, pruned by `upwards`, whose own children may have lost
        // their link to it the same way: linked again, it takes them back.
        revived = dead(own);
    }

    // One line up, not a copy of everyone above. A child under two parents keeps
    // both, and a mutation reaches the readers of either.
    if (own.parents === undefined) {
        own.parents = [marker];
        own.linked = new WeakSet([marker]);
        own.sweepAt = SWEEP_FROM;
    } else if (!own.linked.has(marker)) {
        // The list grows here and only here, so it is swept here: a parent
        // whose container is gone leaves. `upwards` does the same when the
        // child changes, but a shared child may never change, and each mount
        // that wrapped it in a container of its own left one link behind.
        //
        // Once the list has doubled since it was last swept, and in place,
        // since a climb in progress reads it by index: swept at every growth,
        // a child shared by n containers, a class read through each of its
        // instances, paid for n² links.
        if (own.parents.length >= own.sweepAt) {
            let kept = 0;

            for (const one of own.parents) {
                if (one.target.deref() === undefined) own.linked.delete(one);
                else own.parents[kept++] = one;
            }
            own.parents.length = kept;
            own.sweepAt = Math.max(SWEEP_FROM, 2 * kept);
        }

        own.parents.push(marker);
        own.linked.add(marker);
    }

    // Keyed on the container, not on its marker: the child holds the marker
    // for as long as the link lasts, and through it the key, an object of the
    // author's that the dict itself had let go. The container already holds
    // its key, so this holds it no longer than the container lives.
    if (key !== undefined) (own.keys ??= new WeakMap()).set(parent, key);
    if (loose) (own.loose ??= new WeakSet()).add(parent);

    if (name !== undefined) {
        const names = (own.names ??= new WeakMap());

        if (!names.has(parent)) names.set(parent, new Set());
        names.get(parent).add(name);
    }

    if (revived) adopt(child);

    return child;
}

// Subscribe the caller to the value it is being handed.
//
// Every other accessor reads the revision of its own name, which is enough. A
// `@derived` is not: Svelte memoises it on `===`, so a derived that returns the
// very object it was given propagates nothing when that object is mutated in
// place: the computation re-runs, the value compares equal, and the chain stops
// there. Reading the marker re-establishes it at the far end, where the reader
// is, rather than trying to defeat the memoisation.
export function follow(value) {
    if (watchable(value)) {
        const marker = MARKS.get(value);
        if (marker !== undefined) marker.follow();
    }

    return value;
}

// A Python line as a line of the file. `lines` is a number, the count of lines
// before the `<script>` body, or that number with the ranges of Python lines
// the template's functions occupy, since those are generated after the body: a
// line in one of them is reported at the markup it stands for, and any other
// line is the author's own.
const inFile = (line, lines) => {
    if (typeof lines === 'number') return line + lines;

    const range = lines.ranges.find(([from, to]) => line >= from && line <= to);

    return range === undefined ? line + lines.offset : range[2];
};

// That offset, per file, as each component registers its own when its module
// runs, and the one place a frame's line is placed from. A line belongs to the
// file its frame is in, and the caller does not know that file: a callback a
// library keeps is called with no component around it, and a handler a
// component sets may be a `.py`'s function, which has no offset and no entry.
// An offset handed in by the caller placed the first in its Python block and
// the second as if it were the component's.
//
// Keyed by the path a component is shown by, relative to its project: one
// project runs per runtime, whose Brython modules are named by that same path.
const FILE_LINES = new Map();

export const fileLines = (file, lines) => {
    FILE_LINES.set(file, lines);
};

// A Brython exception reaching JavaScript carries no `message` and no `stack`,
// so devtools and Vite's overlay show nothing at all: the text sits in the
// Python object, where nothing JS looks. Fill both in, keeping the original
// object so Python semantics upstream are untouched.
export function pyError(error, where) {
    const $B = globalThis.__BRYTHON__;

    // One of ours, thrown by a template helper rather than by Python. It carries
    // its own sentence and the project's prefix; what it cannot know from inside
    // `date()` is which expression called it, and that is exactly what `where`
    // holds. Marked rather than sniffed, so a genuine JavaScript error keeps
    // crossing untouched.
    if (error instanceof Error && error.$svelthon && !error.$located) {
        error.$located = true;
        error.message = `${error.message} (${where})`;
    }

    if (!error || typeof error !== 'object' || error.message !== undefined) return error;

    // Not ours to describe: a JavaScript value thrown through a Python frame,
    // and SvelteKit's own `error()` and `redirect()` do exactly that, must come
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

    // Each frame of the traceback, with its file. The first one is the code
    // `where` names, and its line is the deepest one still in that file: line
    // numbers count from the start of the Python source, which for a component
    // begins after its opening <script> tag, hence `inFile` back to the file's
    // own numbering, by the offset that file registered. A deeper frame in
    // another file is where it actually broke, and it is named with its own
    // file and its own line, placed by that file's offset.
    const frames = [];
    try {
        let tb = $B.$getattr(error, '__traceback__');
        while (tb && tb !== NONE) {
            const code = $B.$getattr($B.$getattr(tb, 'tb_frame'), 'f_code');
            frames.push({
                file: $B.$getattr(code, 'co_filename'),
                name: $B.$getattr(code, 'co_name'),
                line: $B.$getattr(tb, 'tb_lineno')
            });
            tb = $B.$getattr(tb, 'tb_next');
        }
    } catch {
        /* no usable traceback */
    }

    const home = frames[0]?.file;
    const own = frames.filter((frame) => frame.file === home).at(-1);
    const deepest = frames.at(-1);

    let at = own === undefined ? where : `${where}:${inFile(own.line, FILE_LINES.get(home) ?? 0)}`;
    if (deepest !== undefined && deepest.file !== home) {
        at += `; raised in ${deepest.name}(), ${deepest.file}:${inFile(deepest.line, FILE_LINES.get(deepest.file) ?? 0)}`;
    }

    try {
        error.message = `${described} (${at})`;
        if (error.stack === undefined) error.stack = `${error.message}\n    at ${at}`;
    } catch {
        /* a frozen exception: pass it on as it stands */
    }

    return error;
}

// A call that has been made and not finished.
//
// Asked in four places, one of them in `helpers.js`, so it is written once and
// shared. Compared in JavaScript rather than
// through `aio.iscoroutine()`: this runs on every call into Python, template
// expressions included, and a Brython call here costs more than the check saves.
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
const VIEW_OF = new WeakMap();
const VIEWED = new WeakSet();

// The key the originals of a context's Python values are kept under, in the
// context itself (`provide`).
const ORIGINALS = Symbol('svelthon.context-originals');

// A view's prototype is not `Array.prototype` or `Object.prototype` itself, only
// inherits from it: Svelte wraps a plain array or object put in a `$state` in a
// proxy of its own, which keeps every write to itself, so a JavaScript parent
// that binds a Python list would push into a copy Python never sees, and a
// write to a dict stopped there as well. Not being one, by identity, is what
// tells Svelte to keep the view as it is. Every method, the iterator and
// `Array.isArray` are the array's.
const LIST_VIEW = Object.create(Array.prototype);

// And a dict's or an instance's carries `Object.prototype`'s own names, each
// the same property: SvelteKit's serialiser (`devalue`) takes an object for a
// plain one by those names, as it takes one from another realm, so a view in
// a `load`'s data is written out as the object it reads as, where Svelte's
// test by identity still keeps it.
const PLAIN_VIEW = Object.defineProperties(Object.create(Object.prototype), Object.getOwnPropertyDescriptors(Object.prototype));

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
    if (one === NONE) return null;

    // A coroutine read off a view is the promise it crosses as anywhere, one run
    // for every reference to it, its result crossing as a returned value does:
    // `{"slow": fetch_slowly()}` returned by a `load()` streams.
    if (pyAwaitable(one)) return crossedAs(one, forReader, (result) => pyExport(result));
    if (one !== null && (typeof one === 'object' || typeof one === 'function') && callable(one)) return pyHandler(one);

    const scalar = pyScalar(one);

    return scalar === undefined ? viewOf(one) : scalar;
};

const INDEX = /^(?:0|[1-9]\d*)$/;

// What JavaScript writes into a view. A plain object or an array of its own is
// data, made Python's the way `to_py` makes it, so that a later write to it goes
// through a view of its own and is followed: after `rows.push({n: 2})`,
// `rows.at(-1).n = 3` reaches the page as well as the data. Svelte draws the
// same line, making a proxy of exactly those two kinds when one is put
// into its state. Anything else crosses as a binding's value does: a view handed
// back is its container again, and a class instance, a Date or a DOM node keeps
// its identity.
const entering = (given) =>
    given !== null &&
    typeof given === 'object' &&
    !VIEWED.has(given) &&
    quietPyType(given) === undefined &&
    (Array.isArray(given) || plainObject(given))
        ? pyData(given)
        : pyBind(given);

// The counter Brython keeps on a dict and moves at each insertion and deletion
// of a key, a symbol of its own (`py_dict.js`), found once by its description:
// a table built from the keys holds until it moves. Not found, every read
// builds the table again, which is slow and right.
let DICT_VERSION;
const dictVersion = () =>
    (DICT_VERSION ??=
        Object.getOwnPropertySymbols(globalThis.__BRYTHON__.empty_dict()).find((one) => one.description === 'VERSION') ??
        Symbol('svelthon.noVersion'));

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
        DICT_KEYS = Object.getOwnPropertySymbols(probe).find((one) => one.description === 'KEYS') ?? Symbol('svelthon.noKeys');
    }

    return DICT_KEYS;
};

// The names a dict view gave the keys at each place of a dict's array of keys,
// by the array: what a place holds never changes, so its name is taken once,
// and a dropped array takes its names with it.
const PLACE_NAMES = new WeakMap();

// Where a dict view's table records a name two keys share.
const TWO_KEYS = Symbol('svelthon.twoKeys');

function viewOf(value) {
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
    const keyFor = (name) => {
        const own = (typeof name === 'string' || typeof name === 'symbol') && $B.$is_member(name, value);

        if (typeof name !== 'string' || $B.hasOnlyStringKeys(value)) return own ? name : MISSING;

        const other = nonStringKeys().get(name);

        if (other === TWO_KEYS || (own && other !== undefined)) twoKeys(name);

        return own ? name : other === undefined ? MISSING : value[dictKeys()][other];
    };
    const holds = (key) => {
        if (sequence) {
            const at = index(key);

            return at !== undefined && at < length();
        }

        return keyFor(key) !== MISSING;
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

            return holds(key) || Reflect.has(shell, key);
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
        deleteProperty(shell, key) {
            if (owns(key)) $B.$delattr(value, key);

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

// The classes whose hash runs nothing of the author's, beside an object hashed
// by its identity: a walk may ask them for the bucket a member is filed under.
// A JavaScript object is hashed by its identity too, through a slot of its own.
const BUILTIN_HASHED = [_b_.int, _b_.float, _b_.str, _b_.bool, globalThis.__BRYTHON__.JSObj];

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

    delete(one) {
        const held = this.#has(one);

        if (held) this.#call('discard', pyBind(one));

        return held;
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
        const walk = {
            // Each member visited, by the hash it is filed under, and the
            // members visited under each hash.
            visited: new Map(),
            filed: new Map(),
            // What arrived since the last pass, and whether the set changed in
            // a way that only reading it all again tells.
            arrivals: [],
            rescan: false,
            visit(one, hash) {
                this.visited.set(one, hash);
                if (!this.filed.has(hash)) this.filed.set(hash, new Set());
                this.filed.get(hash).add(one);
            },
            forget(one) {
                const hash = this.visited.get(one);
                const group = this.filed.get(hash);

                this.visited.delete(one);
                group.delete(one);
                if (group.size === 0) this.filed.delete(hash);
            },
            changed(name, args, result) {
                // A member added is what the set now holds for it, met at its
                // turn, after the others; anything else that may have added
                // is read again, once per call.
                if (name === 'add') {
                    const hash = filed(args[0]);
                    const one = hash === undefined ? MISSING : kept(args[0], hash);

                    if (hash === undefined) this.rescan = true;
                    else if (one !== MISSING && !this.visited.has(one)) this.arrivals.push([one, hash]);

                    return;
                }

                if (name !== 'discard' && name !== 'remove' && name !== 'pop') this.rescan = true;
                if (ARRIVING.has(name)) return;

                // A single removal takes a member equal to the one it names,
                // filed under the same hash, so only those visited under it
                // are asked; any other change asks every member visited.
                const named = name === 'pop' ? result : name === 'discard' || name === 'remove' ? args[0] : MISSING;
                const hash = named === MISSING ? undefined : this.visited.get(named) ?? filed(named);
                const asked = hash === undefined ? [...this.visited.keys()] : [...(this.filed.get(hash) ?? [])];

                // A member that left is forgotten; one the set now holds as
                // another object stayed, and its visit goes to that object.
                for (const one of asked) {
                    const filedUnder = this.visited.get(one);
                    const same = kept(one, filedUnder);

                    if (same === one) continue;

                    this.forget(one);
                    if (same !== MISSING) this.visit(same, filedUnder);
                }
            }
        };
        const marker = MARKS.get(value) ?? mark(value);
        const ref = new WeakRef(walk);
        const members = () => {
            const entries = [];

            for (const [hash, bucket] of Object.entries(value.$store)) {
                for (const one of bucket) if (!walk.visited.has(one)) entries.push([one, hash]);
            }

            return entries;
        };

        (marker.walks ??= new Set()).add(ref);

        try {
            let entries = members();

            while (entries.length > 0) {
                for (const [one, hash] of entries) {
                    if (walk.visited.has(one) || !present(one, hash)) continue;

                    walk.visit(one, hash);
                    yield forReader(one);
                }

                entries = walk.rescan ? members() : walk.arrivals;
                walk.arrivals = [];
                walk.rescan = false;
            }
        } finally {
            marker.walks.delete(ref);
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
        const result = new Set(this.#members());

        for (const one of walk(record.keys())) result.add(one);

        return result;
    }

    intersection(other) {
        const record = setRecord(other);
        const result = new Set();

        if (this.#size <= record.size) {
            for (const one of this.#members()) if (record.has(one)) result.add(one);
        } else {
            for (const one of walk(record.keys())) if (this.#has(one)) result.add(one);
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
            for (const one of walk(record.keys())) result.delete(one);
        }

        return result;
    }

    symmetricDifference(other) {
        const record = setRecord(other);
        const result = new Set(this.#members());

        for (const one of walk(record.keys())) {
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
        for (const one of walk(record.keys())) if (!this.#has(one)) return false;

        return true;
    }

    isDisjointFrom(other) {
        const record = setRecord(other);

        if (this.#size <= record.size) {
            for (const one of this.#members()) if (record.has(one)) return false;
        } else {
            for (const one of walk(record.keys())) if (this.#has(one)) return false;
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

// An iterator walked with `for…of`, which closes it on an early return.
const walk = (iterator) => ({ [Symbol.iterator]: () => iterator });

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

            const found = Reflect.get(shell, key, shell);

            if (typeof found !== 'function') return found;
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

// What leaves a handler, where nothing Python will catch it again.
//
// `pyError` fills a `message` and a `stack` into the Brython exception and hands
// back **the same object**, deliberately: Python semantics upstream have to be
// untouched, and a `except ValueError` further up must still see its own value.
// A DOM handler is the other end of that: past it there is no Python left, only
// whatever the host does with an uncaught error.
//
// What the host does is walk it. A Brython exception carries `ob_type`, and from
// there its class and `__mro__`, which contains itself, so a runner cloning the
// error to send it from its worker to the main thread walks a cycle through a
// class object: `Aborted (core dumped)`, `OOMErrorHandler`, on a five-line
// component whose handler raises.
//
// So the boundary hands over an ordinary `Error` and **keeps nothing of the
// Python object on it**, not even under a non-enumerable property: the walk
// reaches an own property whether it is enumerable or not, so a reference kept
// for a debugger is a reference kept for the serialiser.
function thrown(error) {
    if (error instanceof Error || error === null || typeof error !== 'object') return error;

    // `??` and not `||`, and a mutation sweep cannot tell: the difference is an
    // **empty** message, and the only caller runs `pyError` first, which
    // describes the exception and hands back an `Error`, so the line above
    // returns and this one is reached only for what `pyError` chose to leave
    // alone. Left as it is rather than pinned: a test would fix `''` as the
    // answer, and `''` is the less useful of the two.
    const out = new Error(error.message ?? 'PythonError');

    if (typeof error.stack === 'string') out.stack = error.stack;

    return out;
}

// A promise that can tell it is being waited for.
//
// `await p` on a plain promise never reads `p.then`: the language recognises
// its own kind and goes to the internal machinery instead. A subclass is not
// that kind, so `await` takes the long way and calls `then` like anyone else,
// which is how `schedule` below knows the failure reached somebody. Everything
// that asks stays satisfied: it is still an instance of Promise.
class Waited extends Promise {}

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

// What `await` makes of a value, asked as `await` asks it: a promise is awaited
// as it is, and anything else has its `then` read once, a getter or a proxy's
// trap included, and is awaited through it when that is a function. Undefined
// for a value `await` hands back unchanged, which a dict of callbacks is.
//
// A promise built in another JavaScript context is not an instance of our
// Promise and is found by its `then`, so what it resolves to is converted as a
// local promise's is: a `__js__` helper may resolve one with a Python value.
// A **function** is awaitable too, by the language's rule: `await fn` calls
// `fn.then` like anyone else's.
//
// The `then` read here is the one that runs: what is awaited is a relay that
// calls it, with the value as receiver, at the turn `await` would. A getter that
// throws rejects, as `await` rejects.
const awaited = (value) => {
    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
    if (value instanceof Promise) return value;

    let then;

    try {
        then = value.then;
    } catch (error) {
        return Promise.reject(error);
    }

    if (typeof then !== 'function' || globalThis.__BRYTHON__.is_dict(value)) return undefined;

    return { then: (resolve, reject) => Reflect.apply(then, value, [resolve, reject]) };
};

// Calling an `async def` from JavaScript returns a coroutine that nobody runs:
// the handler appears to do nothing at all, silently. Brython has its own event
// loop, so hand it over. `convert`, when given, is applied to the value the
// coroutine returns, the conversion a synchronous result gets at the same site.
export function schedule(result, where, convert = undefined) {
    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (!aio || result === undefined || result === null) return result;

    // Compared in JavaScript rather than through aio.iscoroutine(): this runs on
    // every call into Python, template expressions included, and a Brython call
    // here costs more than the check saves.
    if (!pyAwaitable(result)) return result;

    // What the caller gets back is a promise, so an `async def` can be awaited
    // by whoever called it, `{#await greet()}` in a template above all, which
    // received `undefined` for as long as this returned nothing.
    //
    // run(coro, onsuccess, onerror). Its default onerror only logs, so an
    // exception raised inside a coroutine reaches nothing at all: no error
    // event, no overlay.
    let watched = false;

    // The run comes from `started`, shared with `scheduleAsync`: one coroutine
    // object is one execution whoever asks, and a handler is an asker like any
    // other. What stays local is everything below: the promise that knows
    // whether anybody awaited it, and the rethrow for a failure nobody caught.
    const promise = new Waited((resolve, reject) => {
        (convert === undefined ? started(result) : started(result).then(convert)).then(
            resolve,
            (error) => {
                const failure = pyError(error, where);
                reject(failure);

                // An event handler's return value is dropped on the floor, so
                // nobody is there to catch this one. Rethrowing from a timeout
                // turns it into a genuine uncaught error, the way the
                // synchronous path already behaves, but only when the caller
                // really did ignore the promise, or a template that awaits and
                // renders `{:catch}` would report the failure twice. Thrown to
                // the host as the synchronous path throws it, an ordinary
                // `Error`; the promise keeps the Python exception.
                setTimeout(() => {
                    if (!watched) throw thrown(failure);
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

// A key written, and not assigned. `out[key] = value` runs the setter that
// `__proto__` has on `Object.prototype`, so a dict holding that key would lose
// it, and the object's prototype would be whatever the key held. A key is data
// here, wherever it came from.
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

// The pairs of a mapping as Python code outside the dict reads them,
// `value.items()`, which is what CPython's `urlencode` and `json.dumps` ask: an
// exact dict's own, and a subclass's through its `items`, which may filter,
// rewrite or refuse. Each row is read by `pair`, the caller's own rule.
// `pyEntries` is the storage, which the tracking needs and which a subclass's
// `items` is not.
export function pyItems(value, pair) {
    const $B = globalThis.__BRYTHON__;

    if (!$B.is_dict(value) || (quietPyType(value) ?? $B.get_class(value)) === _b_.dict) return pyEntries(value);

    return __pybridge.seq($B.$call($B.$getattr(value, 'items'))).map(pair);
}

// `for key, one in rows`, which is how `urlencode` reads a row: any iterable
// of two.
export function unpackedPair(row) {
    const pair = __pybridge.seq(row);

    if (pair.length !== 2) {
        const told = pair.length > 2 ? 'too many' : 'not enough';

        globalThis.__BRYTHON__.RAISE(_b_.ValueError, `${told} values to unpack (expected 2, got ${pair.length})`);
    }

    return pair;
}

// What `json.dumps` takes of a row: a tuple of two, and nothing else.
function tuplePair(row) {
    if (!Array.isArray(row) || !globalThis.__BRYTHON__.is_tuple(row) || row.length !== 2) {
        globalThis.__BRYTHON__.RAISE(_b_.ValueError, 'items must return 2-tuples');
    }

    return [row[0], row[1]];
}

const define = (target, key, value) =>
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
const crossedAs = (coroutine, policy, convert) => {
    let crossing = CROSSED.get(coroutine);

    if (crossing === undefined) {
        crossing = { run: scheduleAsync(coroutine, 'coroutine'), views: new Map() };

        CROSSED.set(coroutine, crossing);
    }

    let view = crossing.views.get(policy);

    if (view === undefined) {
        view = crossing.run.then(convert);

        crossing.views.set(policy, view);
    }

    return view;
};

// What an exported function hands back to the framework.
//
// SvelteKit serialises whatever `load()` returns, and a Brython dict carries
// symbol-keyed internals (`Symbol(OB_TYPE)`) that its serialiser refuses
// outright. So the boundary converts: Python containers become plain JavaScript
// data, which is the only shape anything outside Python can read anyway.
// `adapt` is the third caller-said rule, beside the two `seen` carries, and only
// one caller passes it: the arguments of a JavaScript call. A Python callable is
// the one value JavaScript genuinely cannot use, and `outbound` wrapped the ones
// handed over *directly* while this walk handed the ones inside a container
// across untouched. `direct(done)` worked and `nested({"done": done})` raised on
// a positional argument the author never declared, for the same function. It is
// a parameter and not a change of policy because the other five consumers must
// not get it: `tojson` has no use for a wrapper, and JSON cannot hold one.
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

export function plainData(value, seen, adapt) {
    if (value === undefined || value === null || value === NONE) return null;
    if (typeof value === 'function') return adapt === undefined ? value : adapt(value);

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
    // whose class defines `__call__`), and only when someone asked for
    // adaptation: with no rule there is nothing to do with it, and the walk
    // below is what it has always had.
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

    // A coroutine handed to the framework becomes a promise. That is what lets a
    // `load()` stream: `{"lentes": chercher_lentement()}` returns a coroutine,
    // and SvelteKit waits on the promise it turns into. An `aio.Future` is one
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

    if (javascriptOwn(value)) return value;
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
const sequence = (value) => {
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
        // too, and a component renders `rows` and exports it the same way.
        //
        // What `iterated` hands back is walked by its indices: a JavaScript
        // array is its indexed elements, as `JSON.stringify` and a structured
        // clone read it, and not what a `Symbol.iterator` of its own yields.
        const out = shell ?? [];
        const items = iterated(value);

        for (let i = 0; i < items.length; i++) out.push(plainData(items[i], seen, adapt));

        return out;
    }

    // A class is not data to flatten. `pyExport` already decided that at the top
    // level; this is the same decision one level down, where a class sits in a
    // dict a `load()` returns or in a list a component holds.
    if (pyClass(value)) return value;

    // Anything of a class of its own is not ours to flatten: a Response, a URL,
    // a Date, a Map, a Promise: a Python `load()` may hand any of those straight
    // back to the framework, and copying their keys would destroy them.
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
    // the iteration reads `ob_type` besides. SvelteKit wraps `event.params` in a
    // proxy that records every key read, and `pyDict` snapshots it at the
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
// object, so `{1.5: "x"}` would otherwise be keyed by `[object Object]`.
const propertyKey = (key) => (typeof key === 'symbol' ? key : String(plainData(key)));

function propertyName(key, out, seen, adapt) {
    if (typeof key === 'symbol' && adapt !== undefined && seen instanceof Set) adapt(key);

    const name = propertyKey(key);

    if (Object.hasOwn(out, name)) twoKeys(name);

    return name;
}

// Two keys Python keeps apart that JavaScript can only spell one way. The
// narrowing is the destination's, but the silence would be ours, and this
// project's own rule for the moment is written one file over: a serialiser
// meeting something it cannot serialise owes the author a sentence.
function twoKeys(name) {
    const error = new Error(
        `svelthon — this dict has two keys JavaScript cannot tell apart: ` +
            `\`${String(name)}\` is what both of them spell as a property name. A ` +
            `JavaScript object has string keys only, so one would silently ` +
            `replace the other on the way out.`
    );

    error.$svelthon = true;

    throw error;
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
function pyDict(entries) {
    const $B = globalThis.__BRYTHON__;
    const out = _b_.dict.$factory();

    for (const [key, value] of entries) $B.$setitem(out, key, value ?? NONE);
    return out;
}

// The inbound twin of `plainData`: a JavaScript value as real Python. The walk
// is Brython's own `JSObj.to_dict()`; what is left here is the root, which a
// method on an object cannot speak for: a scalar, a null, a bare array.
//
// What it buys, on a value that only ever crossed from JavaScript: `.get()`,
// `.items()` and `isinstance(x, dict)`. Without it, `.get` and `.keys` raise
// AttributeError while `.items` silently returns the *value* of a key spelled
// "items", a failure whose shape depends on the data.
export function pyData(value, made) {
    const $B = globalThis.__BRYTHON__;

    if (value === undefined || value === null) return NONE;

    if (typeof value !== 'object') return pyBind(value);

    // A view a JavaScript reader was handed is its container again, at any
    // depth: `{item: values.original}` holds the dict itself, not a copy of it.
    if (VIEWED.has(value)) return pyBind(value);

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
        for (const one of value) list.push(pyData(one, made));

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
        for (const [key, one] of Object.entries(value)) $B.$setitem(dict, key, pyData(one, made));

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

// Does it behave like a URL, asked somewhere a throw is expected rather than
// fatal.
//
// A behaviour and not `instanceof URL`: a URL built in another JavaScript
// context answers everything a URL answers and fails the identity, and a genuine
// event would cross as an ordinary object, the Python handler raising on
// `event['method']`. The same holds for `Request` below.
//
// The path and the scheme rather than the query, because those are the parts a
// prerendered page necessarily has: it is rendered *for* a path. While
// prerendering, SvelteKit hands over a **proxy** that refuses the one part a page
// built ahead of time cannot have, `searchParams`, so no member it is known to
// guard is read at all, and the `try` of the caller keeps whatever a guarded
// member does from escaping.
//
// A throw answers **no**. Refusing a genuine event is loud: the handler raises
// on `event['method']` and the author reads a Python error. Admitting a business
// object whose getter throws is silent: its fields disappear and the page is
// merely wrong. Between a loud wrong answer and a quiet one, take the loud one.
//
// And a URL is **a value of a class**, never a bag of keys, the question
// `plainObject` answers for `plainData` too: an ordinary HTTP context whose `url`
// is `{pathname, protocol, href, searchParams}`, a real Request, a fetch and
// params beside it, keeps its own fields. Every URL a framework hands over
// carries its own prototype, our realm's or another's; only an imitation is
// built out of Object.
//
// Its members are read by `member`, which runs no getter of the author's.
const urlish = (value) =>
    value !== null &&
    typeof value === 'object' &&
    typeof member(value, 'pathname', true) === 'string' &&
    typeof member(value, 'protocol', true) === 'string' &&
    !plainObject(value);

// A SvelteKit request event, recognised by what its members *are*.
//
// Not by three names being truthy, `params`, `url`, `request`: three names are
// not rare, and a business object carrying them would lose its own fields at
// the level Python reads.
//
// Names are cheap; behaviour is not. A URL answers with a path and a scheme, a
// Request answers `headers.get` and carries a string method, and `fetch` is the
// member SvelteKit puts on every event and no data structure has any reason to
// hold. So four independent things have to be true at once, and an object that
// is all four is a request event whatever it was built by, which is the point,
// since an adapter may hand over a `Request` from another realm, where
// `instanceof` answers false for the genuine article.
//
// `params` last, and only that it is an object: it is the field a route with no
// parameters leaves empty, so it can say the least.
//
// **The whole probe is inside the `try`, not one member of it**: every member
// here is a property read on an object nobody vouched for, a prerendered page's
// guarded `searchParams` and a business object's lazy `fetch` alike. Asking
// what something is must not be able to fail: a throw is a
// **no**, for the same reason as one member down, since refusing a genuine
// event is loud and admitting a business object is silent.
//
// And it must not run what it asks of, at any depth. SvelteKit builds an event
// as a plain object, every one of these four a field of it, and the platform
// gives the rest: a Request's `method` and `headers`, a URL's path, through
// getters of its own. So a member is read only where it is a field, or a
// getter the platform wrote, which runs no code of anyone's, and is read then
// as the object answers it, a prerendered page's proxied URL included. A
// getter the author wrote, a business object's lazy `fetch` or `method`, is
// not an event's, and is not run to find that out.
//
// The platform's getters are those its own classes carry, the very functions,
// found along their prototypes: not a class of the same name, and not a
// function that prints as native code, which a bound function or a proxy does
// while running the author's.
//
// A URL or a Request of another context, an iframe's, carries that context's
// getters, which are other functions; and SvelteKit writes getters of its own
// on the URL of every `load()`, which note the read. Either is asked by ours
// instead: the platform's own getter, applied to it, checks that it holds the
// platform's slots, and reads them, or throws for anything else, before any
// code of the author's or the framework's could run. An object whose four
// members are the platform's own objects is an event, whoever wrote a getter
// on them.
const NO_FIELD = Symbol();
const PLATFORM = ['Request', 'Response', 'URL', 'Headers'];
const platformGetters = (name) =>
    PLATFORM.flatMap((one) => {
        const found = [];
        for (let proto = globalThis[one]?.prototype; proto; proto = Object.getPrototypeOf(proto)) {
            const getter = Object.getOwnPropertyDescriptor(proto, name)?.get;
            if (getter !== undefined) found.push(getter);
        }
        return found;
    });
//
// A member described nowhere along the prototypes is no field: an event's are
// all described, and a business object that is a proxy is not read through
// its trap. Only a URL's path and scheme, `answered`, are then asked of the
// URL itself, which a URL handed over from another context answers.
const member = (value, name, answered = false) => {
    for (let at = value; at !== null; at = Object.getPrototypeOf(at)) {
        const own = Object.getOwnPropertyDescriptor(at, name);
        if (own === undefined) continue;
        if ('value' in own) return own.value;
        if (own.get === undefined) return NO_FIELD;

        const ours = platformGetters(name);
        if (ours.includes(own.get)) return value[name];

        for (const getter of ours) {
            try {
                return Reflect.apply(getter, value, []);
            } catch {
                // Not the platform's object: the next class, or no field.
            }
        }

        return NO_FIELD;
    }
    return answered ? value[name] : NO_FIELD;
};
const routeEvent = (value) => {
    try {
        const [fetch, url, request, params] = ['fetch', 'url', 'request', 'params'].map((name) => member(value, name));
        if (request === null || typeof request !== 'object') return false;

        const headers = member(request, 'headers');

        return (
            typeof fetch === 'function' &&
            urlish(url) &&
            typeof member(request, 'method') === 'string' &&
            headers !== null &&
            typeof headers === 'object' &&
            typeof member(headers, 'get') === 'function' &&
            params !== null &&
            typeof params === 'object'
        );
    } catch {
        return false;
    }
};

export function pyArg(value) {
    // An absence is `None`, the rule `pyData` applies: `value is None` in the
    // function called has to be true for a `null` or an `undefined`.
    if (value === null || value === undefined) return NONE;
    if (typeof value !== 'object') return pyBind(value);
    if (!routeEvent(value)) return value;

    // Reading the framework's own searchParams is what registers the dependency,
    // so it is tried first, but it throws while prerendering, where a query
    // string cannot exist. Parsing the URL again is the fallback, and it touches
    // nothing SvelteKit guards.
    //
    // `href` rather than `String(url)`, here and below. The URL is a **proxy**
    // while prerendering, and `String()` calls `toString` with the proxy as the
    // receiver, which Node refuses (*Receiver must be an instance of class
    // URL*). A getter read goes through the trap with the real URL underneath it,
    // which is what a proxy that forwards reads is built to do, and it answers
    // the same string.
    let query;
    try {
        query = [...value.url.searchParams];
    } catch {
        try {
            query = [...new URL(value.url.href).searchParams];
        } catch {
            query = [];
        }
    }

    // `?tag=a&tag=b` is one key twice, and a dict holds one value for it, so
    // `event["query"]["tag"]` has to answer what
    // `event["js"].url.searchParams.get("tag")` answers about the same request.
    //
    // The first wins, because that is what `searchParams.get` answers about the
    // very same URL. Django's `QueryDict` would say the last and Flask's
    // `MultiDict` the first, so Python has no single answer to take; what
    // removes the contradiction is agreeing with the object standing beside it.
    //
    // A dict cannot hold both, and this does not invent a second view for them:
    // `event["js"].url.searchParams.getAll("tag")` is where every value is, and
    // it is the escape hatch the snapshot already documents.
    const seen = new Set();

    query = query.filter(([key]) => !seen.has(key) && seen.add(key));

    // Real dicts, not JavaScript objects: Python reaches for `.get()` and
    // `.items()`, and a JSObj has neither.
    return pyDict([
        ['params', pyDict(Object.entries({ ...value.params }))],
        ['query', pyDict(query)],
        ['url', value.url.href],
        ['method', value.request.method],
        ['route', value.route && value.route.id],
        // The event itself, for whatever the snapshot does not cover: cookies,
        // fetch, setHeaders. It is a JavaScript object and stays one.
        ['js', value]
    ]);
}

// The same, for a module whose caller can wait: a framework awaits `load()`,
// so a coroutine has to come back as a promise rather than be fired and
// forgotten. Inside a component nobody awaits a handler, which is why the two
// are separate.
// One coroutine object, one run, whoever asks and by whichever route.
//
// The memo lives here, at the one function that calls `aio.run`. Both
// schedulers ask it: `scheduleAsync` for a value crossing to a caller who will
// await it, `schedule` for a DOM handler whose return value nobody reads.
//
// A Python coroutine is not freely re-runnable, so the same object, returned
// twice or handed to a handler on every event, runs its body once.
//
// The run rejects with Python's own error and nothing else; the position is
// added by each caller below. The trade: `pyError` describes an exception once
// and returns it untouched afterwards, so when one coroutine is handed out by
// two routes the *label* is the first asker's. The line stays the author's,
// since it comes from the traceback and not from the label.
//
// An `aio.Future` is under way already, and is its own run.
const RUNS = new WeakMap();

function started(coroutine) {
    if (!pyCoroutine(coroutine)) return coroutine;

    let run = RUNS.get(coroutine);

    if (run === undefined) {
        const $B = globalThis.__BRYTHON__;

        run = new Promise((resolve, reject) => {
            $B.$getattr($B.imported['browser.aio'], 'run')(
                coroutine,
                (value) => {
                    $B.leave_frame();
                    resolve(value);
                },
                reject
            );
        });

        RUNS.set(coroutine, run);
    }

    return run;
}

export function scheduleAsync(result, where) {
    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (!aio || result === undefined || result === null) return result;
    if (!pyAwaitable(result)) return result;

    return started(result).catch((error) => {
        throw pyError(error, where);
    });
}

// A copy that is still whatever it was, so the original stays Python's.
//
// The two halves are not interchangeable. A Brython dict keeps its items as own
// properties beside three symbol-keyed internals, and `Object.create` with its
// descriptors gives back something `repr` still prints as a dict. A Brython list
// is a real array carrying `ob_type` beside its items, and `Object.create`
// cannot make an array: exotic `length` is not a descriptor.
//
// `{ ...value }` is what neither of them survives, which is why it is not here.
function shallow(value) {
    if (!Array.isArray(value)) {
        return Object.create(Object.getPrototypeOf(value), Object.getOwnPropertyDescriptors(value));
    }

    const out = value.slice();

    for (const key of Object.getOwnPropertyNames(value)) {
        if (key !== 'length' && !/^\d+$/.test(key)) {
            Object.defineProperty(out, key, Object.getOwnPropertyDescriptor(value, key));
        }
    }

    return out;
}

// What a function the *framework* calls hands back: a transition, an action.
// Svelte does arithmetic on it: `Element.animate` refuses a duration that is not
// a number, and a Brython float is an object holding one.
//
// Only floats are unwrapped, one level down. Converting the whole value with
// `plainData` would be wrong: the same function can be called from Python, where
// a dict must stay a dict and a list must print as a list.
//
// **On a copy, and only once one is needed**: the object is the caller's, and
// an `@export` returning state Python also keeps must find it as it was. The
// copy is built on
// the first replacement and not before, so the common case, a transition dict of
// plain numbers, allocates nothing.

export function pyNumbers(value) {
    // A JavaScript function Python held through its adapter goes out as itself.
    // `None` itself is a singleton and not a container: walking its own
    // properties would copy it, and the copy is no longer `None`. A view reads
    // its numbers out as JavaScript's already (`viewOf`).
    if (value === null || typeof value !== 'object' || value === NONE || VIEWED.has(value)) return value;

    // Nor is a callable: a bound method is `{ob_type, im_func, im_self}`, and
    // walked as a config its `im_func` would become a JavaScript wrapper. It
    // goes on whole, and the boundary that receives it adapts it.
    if (callable(value)) return value;

    const alone = pyScalar(value);

    if (alone !== undefined) return alone;
    if (javascriptOwn(value)) return value;

    let out = value;

    for (const key of Object.keys(value)) {
        const one = value[key];
        let replacement;

        const held = pyScalar(one);

        if (held !== undefined) {
            replacement = held;
        } else if (callable(one)) {
            // A callback the framework keeps and calls itself, a transition's
            // `tick(t, u)`. It never crosses a wrapper, so its arguments arrive
            // as raw JavaScript numbers, and Brython reads a number as an int:
            // `tick(0, 1)` works, since 0 and 1 *are* integers, and the next
            // frame would raise `0.0026 can't be converted to BigInt`.
            //
            // Asked as `callable` and not as `typeof one === 'function'`: a
            // bound method is an object, and `{'tick': ticker.tick}` is called
            // all the same. `pyHandler` binds the receiver and reads the
            // signature, and the numbers are converted on the way in.
            // Through `pyHandler` whatever the shape, because the adaptation is
            // not only about being callable: `pyCall` converts what the callback
            // *returns*, so `easing(0.5)` hands Svelte a number and not a
            // Brython float.
            //
            // A function JavaScript built is left alone, and *left alone* means
            // the arguments too: a library's own `t => t.toFixed(2)`, handed
            // through a Python component, is given the numbers the framework
            // gives. The conversion is what a *Python* callback needs
            // from a framework that calls it with raw numbers; for a JavaScript
            // one it is a change of contract, on a function the author never
            // asked us to touch.
            //
            // Told apart by the answer `pyHandler` already gave, rather than by
            // a second predicate: it returns the value itself when there was
            // nothing to adapt.
            replacement = pyHandler(one);

            if (replacement === one) continue;
        } else if (one === NONE) {
            // An absent field, which the framework tests for: Svelte asks `if
            // (tick)` before calling it, and Python's `None` is an object, so
            // `{'tick': None}` was a callback to call. `None` is `undefined` on
            // the JavaScript side, the pairing the engine keeps at every other
            // crossing.
            replacement = undefined;
        } else continue;

        if (out === value) out = shallow(value);

        // Defined rather than assigned. Svelte hands back an instance whose
        // exports are *getters*, and `shallow` copies a descriptor as it found
        // it, so a plain `out[key] = …` would throw `Cannot set property bump
        // of #<Object> which has only a getter`, on a `bind:this` teardown.
        Object.defineProperty(out, key, {
            value: replacement,
            writable: true,
            enumerable: true,
            configurable: true
        });
    }

    return out;
}

// The crossings, all of them, in one place.
//
// Seven functions below carry a value between Python and JavaScript, and each
// applies some part of the same five treatments. Every choice is argued beside
// the function it belongs to, and that is the right place for a *reason*; it is
// the wrong place for a *comparison*, because the choices are not independent.
// Whether a `load()` converts its result and a DOM handler does not is one
// decision taken seven times, and nobody could see it without this table.
//
//                | arity | args in  | coroutine | result out | memoised |
//   pyCall       |  yes  | pyArg    | awaited   | pyExport   |          |
//   pyHandler    |  yes  | pyCall, with the arity read off the signature  |
//   pyEvent      |  yes  | pyArg    | fired     |            |          |
//   pyExport     |       |          |   (a)     | plainData  |   yes    |
//   jsCall       |       | outbound |           | inbound    |          |
//   pyComponent  |  yes  |          | scheduled | pyNumbers  |          |
//   pyExpression |       | pyBind   | scheduled | pyNumbers  |          |
//
// And the values that cross without a call, one row per door. The rule is the
// same everywhere: a scalar becomes the other language's own, an absence None
// or null, and a container keeps its identity, since that is what a mutation is
// followed by.
//
//                     | JavaScript to Python | Python to JavaScript |
//   a prop            | pyBind               |                      |
//   `bind:`           | pyBind               |                      |
//   a store property  | pyArg (setter)       | storeMember (getter) |
//   a store @derived  |                      | storeMember (getter) |
//
// `storeMember` is `plainScalar` for a value, and for a Python callable the
// call `pyComponent` makes, whatever bound the name.
//
// (a) `pyExport` hands a coroutine to `plainData`, which schedules it and
//     converts what it resolves to. A handler *fires* one and an exported
//     function *awaits* one, and that is the difference between `schedule` and
//     `scheduleAsync`: nobody is there to catch what a handler returns.
//
// One Python function, made callable from JavaScript: arguments converted on the
// way in, coroutines awaited, containers converted on the way out.
//
// The arity matters. JavaScript calls with whatever it has, and SvelteKit hands
// a query handler the validated payload whether or not the handler wants one,
// where Python raises on a positional argument it never declared. So the call is
// trimmed to the signature, which is what `def load():` beside `def load(event):`
// has always been allowed to mean.

// A wrapper's name, out of the label its builder already carries. Every `where`
// in this file is either `name() — file`, which `declared` writes, or the name of
// an export; both leave the right word in front.
const nameOf = (where) => where.split(' — ')[0].replace(/\(\)$/, '');

// What a caller may hand a Python function: trimmed to what the signature
// declares, and converted.
//
// The trim is the boundary's contract (it is what lets a framework hand an
// event to a callback that never asked for one), and `pyArg` is the conversion
// every call boundary owes, written here once for the three wrappers below.
//
// **Trimmed first, then converted, and only what is passed.** An argument the
// callable does not take is never read: converting it means asking whether it is
// awaitable, which reads its `then`, and a payload the callback discards must
// not be able to fail the call or be observed by it.
//
// `arity` is a number, or a function answering it at the call: a callable
// instance trims against whatever its class holds now, so its arity is a
// question asked each time, not a number fixed once.
const arityNow = (arity) => (typeof arity === 'function' ? arity() : arity);

const taken = (args, arity, convert = pyArg) => args.slice(0, arityNow(arity)).map(convert);

// The two own properties every JavaScript function has, told the truth about the
// Python one behind them.
//
// **`name`** is what a caller reads in a log, in a stack, and in a library that
// dispatches on it. **`length`** is what a library reads to learn a callback's
// arity, and a function that takes a rest parameter, which every wrapper here
// is, declares nothing, so it is set from the `def`.
//
// Every wrapper a JavaScript caller can hold is built here, so one place covers
// every route and the generated code pays nothing.
//
// `Infinity` keeps the 0: `*args` has no number to report, and 0 is what
// JavaScript says of a rest parameter.
const identified = (wrapper, name, arity) =>
    Object.defineProperties(wrapper, {
        name: { value: name, configurable: true },
        length: { value: Number.isFinite(arity) ? arity : 0, configurable: true }
    });

// What a call hands back crosses as an export does, a container as its view.
// A dict's keys are named here, inside the call, by the copy's own rule: one
// JavaScript cannot spell, `{1: "a", "1": "b"}`, is refused while the refusal
// can still name the call that returned it. One held deeper is refused as it is
// read, as an exported one is.
const handedBack = (value, where) => {
    const out = pyExport(value, where);

    if (VIEWED.has(out) && globalThis.__BRYTHON__.is_dict(value)) {
        const names = {};

        for (const [key] of pyItems(value, unpackedPair)) define(names, propertyName(key, names), true);
    }

    return out;
};

export function pyCall(fn, where, arity = Infinity, named, convert = pyArg) {
    const wrapper = (...args) => {
        try {
            const given = taken(args, arity, convert);
            const result = scheduleAsync(fn(...given), where);

            // The result crosses under the same rule as an export, callbacks
            // included: a callable *returned by* an exported function is adapted
            // as the same value exported directly is. One value, one contract,
            // whether it was published or returned.
            // `await` rather than `result.then`, because a bare thenable's
            // `then` answers whatever its author wrote (`undefined` for the
            // three-line shape everyone writes), and what a caller was handed
            // has to stay awaitable. The async function hands back one promise
            // of this realm for every shape.
            //
            // What is awaited settles after this `try` has returned, so it
            // carries its own: a rejection, an `aio.Future` failed by Python
            // among them, and a refusal of the resolved value's conversion name
            // the call the way the same error does when raised directly. A
            // JavaScript error or value it rejects with passes as it is.
            const pending = awaited(result);

            if (pending === undefined) return handedBack(result, where);

            return (async () => {
                try {
                    return handedBack(await pending, where);
                } catch (error) {
                    throw pyError(error, where);
                }
            })();
        } catch (error) {
            throw pyError(error, where);
        } finally {
            flushExports();
        }
    };

    // The name a JavaScript caller reads: in a log, in a stack, in a library
    // that dispatches on it, and in this project's own refusals. A function
    // expression carries the name of the binding it is assigned to and nothing
    // else, so the same `def` would answer `plain` at the top level of a module
    // and `""` from inside a list.
    //
    // The two own properties every JavaScript function has, both told about the
    // call rather than about the framework.
    //
    // **`name`**: what Python recorded, read off `$function_infos` rather than
    // off `fn.name`, since Brython names the JavaScript function it compiles
    // after a counter, `f6084…`. `named` is what a
    // caller holding the `declared` answer passes: the callable's own label,
    // `Box.save` or `Handler.__call__`, where `where` is the *export's* label,
    // so a callable published inside a dict is named after itself and not after
    // **the dict**.
    //
    const infos = fn.$function_infos;

    return identified(wrapper, named ?? ((Array.isArray(infos) && infos[2]) || nameOf(where)), arityNow(arity));
}

// What Python really handed over, and what it declares. The layout is Brython's
// `$function_infos`: [2] the qualified name, [3] the file, [8] the `*args` name
// if there is one, [10] how many positional parameters were declared.
//
// Anything that is not a Python function comes back as null.
//
// A function read off *another* module, `helpers.click` as a handler, arrives
// as itself: `$B.imported` holds a plain JavaScript object, and Brython's
// interop hands back a function that carries a class untouched, so its own
// `$function_infos` answer.
//
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
const callDescriptor = (value) => {
    const $B = globalThis.__BRYTHON__;

    const type = pyType(value);

    if (type === undefined || pyClass(value) || boundMethod(value)) return null;

    const found = declares(type, '__call__');

    return found === $B.NULL ? null : found;
};

// Callable in Python, which is wider than *is a JavaScript function* and is the
// question every boundary that promises to adapt a callback has to ask.
//
// Exported for the one caller outside this file that has to ask the same
// question: the serialiser. What crosses to JavaScript as a call has no JSON,
// and a second predicate written in `helpers.js` would answer differently the
// day this one learns another shape.
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
const slotCallable = (value) =>
    quietPyType(value) !== undefined &&
    !pyClass(value) &&
    _b_.callable(value) === true;

// One JavaScript function per such value, so it is one callback however often
// it crosses.
const SLOT_CALLS = new WeakMap();

// Its contract: Python on both sides, no signature to trim to, and Python's
// own call protocol.
const slotDeclared = (value) => {
    if (!slotCallable(value)) return null;

    const $B = globalThis.__BRYTHON__;
    let fn = SLOT_CALLS.get(value);
    if (fn === undefined) SLOT_CALLS.set(value, (fn = (...args) => $B.$call(value, ...args)));

    return { fn, where: `${value.d_name ?? $B.class_name(value)}() — builtins`, arity: Infinity };
};

// A special method read off a builtin, `rows.__setitem__`: `{ob_type:
// method_wrapper, self, wrapped, d_name}`, which Brython calls through its
// `tp_call` slot rather than a `__call__`, so the class answers what it is.
const wrapperMethod = (value) =>
    value !== null &&
    typeof value === 'object' &&
    ownType(value) === globalThis.__BRYTHON__.method_wrapper &&
    typeof value.wrapped === 'function';

// A method read off an instance: `{ob_type: method, im_func, im_self}`, which
// `typeof` calls an object. Recognised by its class the way everything else
// here is, and not by the two field names, which are Brython's own
// (`descriptors.js`, `$B.method.tp_new`).
const boundMethod = (value) =>
    value !== null &&
    typeof value === 'object' &&
    ownType(value) === globalThis.__BRYTHON__.method &&
    typeof value.im_func === 'function';

function declared(value) {
    // The fourth representation of a bound method, and a builtin's: no
    // signature to read, Python on both sides, called through Python's own
    // protocol, and one callback per receiver and operation.
    if (wrapperMethod(value)) {
        const $B = globalThis.__BRYTHON__;

        return {
            fn: (...args) => $B.$call(value, ...args),
            where: `${value.d_name}() — ${$B.class_name(value.self)}`,
            arity: Infinity,
            origin: value.wrapped.original ?? value.wrapped,
            self: value.self
        };
    }

    const method = boundMethod(value) ? value : null;
    const call = method === null ? finalCall(callDescriptor(value)) : null;

    if (method === null && call === null && typeof value !== 'function') return slotDeclared(value);

    // `@staticmethod def __call__` is kept in the class dictionary as the
    // descriptor Brython builds for it, `{ob_type, sm_callable}`, the function
    // under the second name, so it is unwrapped before its signature is read.
    //
    // Unwrapped here rather than in `callDescriptor`, because what travels with
    // it is the **arity**: a static call takes no receiver, so `self` is not
    // among the parameters to drop.
    //
    // `@classmethod def __call__` is the same shape under `cm_callable`, and its
    // receiver is the class, one parameter to drop like `self`.
    const stat = call !== null && call.sm_callable !== undefined ? call.sm_callable : null;

    // A `__call__` that is itself a bound method, `__call__ = receiver.save`:
    // Python calls it as it is, its own receiver already in it and the instance
    // not handed to it, so its signature is its function's.
    const delegated = call !== null && boundMethod(call) ? call : null;
    const fn = method !== null ? method.im_func : (delegated?.im_func ?? stat ?? call?.cm_callable ?? call ?? value);
    const infos = fn.$function_infos;

    // Nothing of Python's at all: a function JavaScript built, which crosses as
    // the object its library made. Unless the value is Python's and its call is
    // native, the `__call__` a `method_descriptor` inherits: `list.index`.
    if (!Array.isArray(infos)) return method === null ? slotDeclared(value) : null;

    // Python's, but with no signature to read: a **builtin**. `round` carries
    // `["builtins", "round", "round"]` and no arity, because it is written in
    // JavaScript inside Brython rather than compiled from Python.
    //
    // *No signature* is not *not Python's*: `rounded = round` published by a
    // module is called by JavaScript with `0.25`, and has to receive a float.
    // Not knowing what a function takes says nothing about what it *expects*,
    // and a builtin expects Python on both sides.
    //
    // `Infinity` is the honest arity: there is no number to trim to, so
    // everything is passed and the conversion does the rest.
    if (!infos[8] && typeof infos[10] !== 'number') {
        const where = `${infos[1]}() — ${infos[0]}`;

        // A builtin bound to a receiver of its own under a `__call__`,
        // `__call__ = rows.clear`, is an instance's call like any other, trimmed
        // as the builtin is (`callArity`). Any other builtin under a `__call__`,
        // `staticmethod(abs)`, or under a bound method: the object is called
        // through Python's own protocol, as a builtin type's descriptor is.
        if (call !== null && nativeBound(call)) return instanceCall(value, where, fn);
        if (method !== null || call !== null) return slotDeclared(value);

        // A builtin **bound to a receiver**: `rows.append`, which Brython builds
        // fresh on every read as a `builtin_method` carrying `m_self`, the third
        // representation of a bound method in this engine. Keyed on the object
        // handed over, two reads would be two JavaScript functions, and
        // `off(rows.append)` could not find what `on(rows.append)` added.
        //
        // Same identity as an ordinary bound method, one paragraph down: the
        // pair, receiver and operation. The operation is `$function_infos`
        // itself, which is a property of the native function the descriptor
        // wraps, so it is one object per operation and shared by every receiver:
        // `rows.append` and `other.append` name the same operation, and
        // `rows.clear` a different one, which is exactly the distinction a
        // registry holding two lists needs.
        // Whatever the receiver's representation: `"hello".upper` is bound to
        // a JavaScript string, and `perReceiver` keys it by value.
        //
        // One that takes no positional argument is handed none, as a `def` that
        // declares no parameter is: `onclick={rows.clear}` empties the list and
        // `onclick={rows.sort}` sorts it, instead of receiving the event. Any
        // other takes everything.
        if (value.m_self !== null && value.m_self !== undefined) {
            return { fn, where, arity: takesNoPositional(value) ? 0 : Infinity, origin: infos, self: value.m_self };
        }

        return { fn, where, arity: Infinity };
    }

    const where = `${infos[2]}() — ${infos[3]}`;

    if (method === null && call === null) {
        return { fn, where, arity: infos[8] ? Infinity : infos[10] };
    }

    // The receiver is not one of the arguments a caller counts: `def tag(self,
    // suffix)` declares two and JavaScript passes one, and so does
    // `__call__(self, suffix)`. It is bound here rather than left to the call
    // site, so everything downstream (the wrapper, the arity trim, the error
    // position) reads a function of the caller's arity like any other.
    //
    // A bound method is called through the function Brython recorded; an
    // instance goes through `$B.$call`, which is Python's own call protocol and
    // therefore right for a `__call__` that is inherited, decorated, or
    // reassigned on the class after this wrapper was built.
    const self = method !== null ? method.im_self : value;

    // `self` is not one of the arguments a caller counts, except where there is
    // none to count: a static `__call__` declares exactly what it takes.
    const receiver = stat === null ? 1 : 0;
    const arity = infos[8] ? Infinity : infos[10] - receiver;

    if (method !== null) {
        return { fn: (...args) => fn(self, ...args), where, arity, origin: fn, self };
    }

    return instanceCall(value, where, fn);
}

// The instance, whose call is looked up **at every call** and whose contract
// was read once.
//
// A `__call__` reassigned on the class after this wrapper was built,
// `Strategy.__call__ = changed`, runs its new body with its new signature's
// trim. So the two halves move together: the arity goes upward as a question,
// asked at each call against whatever the class holds now, and the wrapper
// that trims asks it before converting anything. The wrapper's identity is
// untouched, which is what a registry that holds a callback needs.
function instanceCall(value, where, origin) {
    return {
        fn: (...args) => globalThis.__BRYTHON__.$call(value, ...args),
        where,
        arity: () => liveArity(value),
        origin,
        self: value,
        // What the author called it, when they called it anything.
        //
        // A JavaScript function has a `name` whether or not anyone chose one, so
        // the choice is which word to put there, not whether to. `Handler.__call__`
        // is the class's; `self.name` is the author's, and `on_save` says more in
        // a log than the qualname of the method that runs it. It is not a field
        // crossing (no field crosses on a callable): it is the better of two
        // names for the same thing.
        //
        // Read off the instance's own storage, never through `$getattr`: a
        // property of the author's must not run because something was named. A
        // string only, since `name` is one.
        named: labelled(value),
        // Which of the three this is, said rather than guessed: `self` alone
        // cannot tell a bound method from an instance, and the two need
        // different identities to be cached by.
        instance: true
    };
}

// What an instance's `__call__` declares at this moment. Null answers, and a
// shape with no signature at all, both mean *take everything*: the call is about
// to go through Python's own protocol, which is the authority on whether it
// works.
// The name an object gave itself, if it gave itself one.
const labelled = (value) => {
    const own = ownAttributes(value);

    return own !== null && typeof own === 'object' && typeof own.name === 'string' ? own.name : null;
};

function liveArity(value) {
    const call = callDescriptor(value);

    return call === null ? Infinity : callArity(call);
}

// How many of its caller's arguments a class's `__call__` takes when the
// instance is called, by what the class holds. A `def` takes its own count but
// `self`; a static one its whole count; a class method its count but `cls`. A
// method already bound, `__call__ = receiver.save` or `Receiver.by_class`, is
// called as it is: its function's count but the receiver it holds, the
// instance never handed to it. A builtin bound to a receiver of its own,
// `__call__ = rows.clear`, takes none when it declares none, as `rows.clear`
// handed over directly does.
function callArity(held) {
    const call = finalCall(held);

    if (boundMethod(call)) return signatureArity(call.im_func, 1);
    if (nativeBound(call)) return takesNoPositional(call) ? 0 : Infinity;
    if (call.sm_callable !== undefined) return signatureArity(call.sm_callable, 0);

    return signatureArity(call.cm_callable ?? call, 1);
}

// A Python function's count of positional parameters but the `receiver` first
// ones, or `Infinity` for one with `*args` or with no signature to read.
const signatureArity = (fn, receiver) => {
    const infos = fn?.$function_infos;

    if (!Array.isArray(infos) || (!infos[8] && typeof infos[10] !== 'number')) return Infinity;

    return infos[8] ? Infinity : infos[10] - receiver;
};

// Where a class's `__call__` lands when it is itself a callable instance,
// `__call__ = zero`: the `__call__` of that instance's class, and so on, as
// Python's call protocol follows it, a cycle stopping where it closes. A
// method, a builtin or a function is where it lands, and so is a value whose
// type has `__get__`, a static or class method among them: Python binds it
// rather than following it, and calls what `__get__` hands back.
function finalCall(call) {
    const seen = new Set();

    while (callableInstance(call) && !seen.has(call)) {
        seen.add(call);
        call = callDescriptor(call);
    }

    return call;
}

const callableInstance = (value) => {
    const $B = globalThis.__BRYTHON__;

    return (
        value !== null &&
        typeof value === 'object' &&
        $B.search_slot($B.get_class(value), 'tp_descr_get', $B.NULL) === $B.NULL &&
        !wrapperMethod(value) &&
        callDescriptor(value) !== null
    );
};

// A builtin bound to its receiver, `rows.clear`: a JavaScript function carrying
// `m_self`, the third representation of a bound method in this engine.
const nativeBound = (value) => typeof value === 'function' && value.m_self !== null && value.m_self !== undefined;

// What to call a Python function in a message: its qualified name as
// `$function_infos` records it, `Box.save` where `__name__` says `save`.
//
// Null for anything Python did not declare, so a caller keeps whatever it shows
// of a value it cannot name.
export const pyName = (value) => {
    const found = declared(value);

    return found === null ? null : found.where.split(' — ')[0];
};

// A Python function seen from JavaScript, wrapped by reading its own signature
// rather than a declaration we made: the same wrapping `pyExport` does, for a
// DOM handler rather than an exported function.
//
// The difference is what happens to a coroutine. An exported function is awaited
// by whoever called it, so `scheduleAsync` hands back a promise. A DOM handler's
// return value is dropped on the floor, so it goes through `schedule`, which
// runs the coroutine and reports a failure nobody observed by throwing it rather
// than leaving a rejected promise nobody will ever look at.
export function pyEvent(value) {
    const found = declared(value);

    // Not a Python function, so there is nothing to wrap, and the value is on
    // its way to a DOM boundary like any other: `bound` is what turns None into
    // undefined there. The handler test claims more than handlers: `on`
    // followed by a lowercase letter also catches `once`, `only` and
    // `onboarding`, which Svelte 5 makes defensible for a component prop.
    if (found === null) return __pybridge.bound(value);

    const { fn: called, where, arity } = found;

    // The line of an error is placed by the file its frame is in (`fileLines`),
    // which is not always the component setting the handler: `onclick={store.boom}`
    // runs a `.py`'s function.
    return (...args) => {
        try {
            return schedule(called(...taken(args, arity)), where);
        } catch (error) {
            throw thrown(pyError(error, where));
        } finally {
            flushExports();
        }
    };
}

// One Python function, one JavaScript function.
//
// A fresh wrapper per crossing is invisible until something compares two of
// them, and JavaScript's own APIs do: `removeEventListener` takes the function
// it was given, and so do `off`, `unsubscribe` and every deduplicating
// registry: `on(handler)` and `off(handler)` must hand over one function, or the
// listener stays and the next `on` adds a second.
//
// Keyed on `found.fn`, the function Brython recorded the signature of, and not
// on the object that arrived: reading `helpers.click` twice gives two interop
// wrappers around one function, and Python calls them the same name. Every
// wrapper this site builds has the same contract (`pyCall(fn, where, 0,
// arity)`, all three read from `fn` itself), so one per function is the whole
// of it. A bound method rebuilt at each read is a different question and is not
// answered here.
const HANDLERS = new WeakMap();

// And for a bound method, one level deeper: receiver, then function. Two maps
// rather than a composite key, because both halves have to be weak: a receiver
// is an ordinary object of the author's and holding it would outlive the page.
const RECEIVERS = new WeakMap();

// And for an instance whose class defines `__call__`, keyed on the instance
// itself: what it is does not change when the class changes what it does.
const INSTANCES = new WeakMap();

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

// What an effect or `on_mount` hands back, made into what Svelte expects of it:
// a cleanup it can call, or nothing. An `async def` hands back a coroutine,
// which is started rather than read as a cleanup, the way Svelte runs an
// `$effect(async () => …)` and does nothing with the promise it returns.
// `{@attach fn}`: called as a handler is, and what it returns is the cleanup
// Svelte runs when the element goes. Svelte keeps it only when `typeof` says
// function, so a bound method or a callable instance handed back was dropped and
// never ran. It goes through `pyTeardown`, the rule an effect's return follows.
//
// One function per callable, because Svelte compares the attachment's identity
// each time the expression runs and tears down and reinstalls on a new one: a
// fresh wrapper at every evaluation reinstalled an attachment whose function had
// not changed. The identity is the one `pyHandler` settles (a function, a
// receiver and its method, an instance), so the two cannot disagree, and it is
// held weakly.
const ATTACHED = new WeakMap();

export function pyAttach(value) {
    const found = declared(value);

    if (found === null) return __pybridge.bound(value);

    const identity = pyHandler(value);
    let attach = ATTACHED.get(identity);

    if (attach === undefined) {
        const { fn: called, where, arity } = found;

        // Exports flushed as the handler flushes them, before Svelte reads on:
        // a `bytearray` the attachment changed is an export already copied.
        attach = (...args) => {
            try {
                return pyTeardown(called(...taken(args, arity)), where);
            } catch (error) {
                throw thrown(pyError(error, where));
            } finally {
                flushExports();
            }
        };

        ATTACHED.set(identity, attach);
    }

    return attach;
}

export function pyTeardown(value, where) {
    if (pyAwaitable(value)) {
        schedule(value, where);
        return undefined;
    }

    const cleanup = pyHandler(value);
    return typeof cleanup === 'function' ? cleanup : undefined;
}

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

export function pyHandler(value) {
    const found = declared(value);

    // A JavaScript function crosses back as itself, and one Python held through
    // its adapter (`jsCall`) as the function the adapter stands for.
    if (found === null) return ADAPTERS.get(value) ?? value;

    // Three identities, because three things arrive here and they are not the
    // same thing twice.
    //
    // A **function** is itself, and `HANDLERS` holds one wrapper per function.
    //
    // A **bound method** is built fresh on every read, so `box.note` twice is two
    // objects and the wrapper it carries cannot be the cache key: an `off` would
    // never match the `on` that preceded it. The pair is what has an identity,
    // the function and its receiver, and keying on the pair is also what keeps
    // two instances of one class apart.
    //
    // A **callable instance** is neither. It is one object for its whole life,
    // and the function that performs its call is not part of who it is: after
    // `Strategy.__call__ = other` a registry given its wrapper can still remove
    // it, and `handler` and `handler.__call__`, two Python values with two
    // contracts, keep a wrapper each. Its own identity is the object, and that
    // is the key.
    const cache = found.instance
        ? INSTANCES
        : found.self === undefined
          ? HANDLERS
          : perReceiver(found.self);

    const key = found.instance ? value : found.self === undefined ? found.fn : found.origin;

    const known = cache.get(key);

    if (known !== undefined) return known;

    // The arguments a JavaScript caller hands are converted the whole way, which
    // a framework calling with raw numbers needs beyond the scalars `pyArg`
    // converts, and only once trimmed to what the callable takes.
    const wrapped = pyCall(found.fn, found.where, found.arity, found.named ?? undefined, (one) =>
        pyArg(inbound(one))
    );

    // An instance trims at the call, against whatever its class holds now, so its
    // wrapper announces `Infinity` and would report an arity of 0. What a library
    // reads should be what the call takes, and a snapshot of it is what a
    // JavaScript function's `length` is anyway.
    if (found.instance) identified(wrapped, wrapped.name, liveArity(value));

    // **The one function published for this callable, at every crossing**: the
    // conversion of what a JavaScript caller hands is the one `pyCall` applies,
    // after trimming, so one Python callback is one JavaScript function, as a
    // prop, in a config, to a library or to a child, and identity is settled
    // here and only here.
    cache.set(key, wrapped);
    PUBLISHED.set(wrapped, value);
    globalThis.__BRYTHON__.PYOBJ_MAP.set(wrapped, value);

    return wrapped;
}

// The Python callable each function `pyHandler` published stands for, so that
// what comes back to Python is the callable it handed over, through every door:
// a context, a write into a view, a set asked whether it holds it, and the
// engine's own conversion (`PYOBJ_MAP`). Back as its wrapper, a function read
// out of a set was not in it, and added again was a second member.
const PUBLISHED = new WeakMap();

// A receiver Brython keeps as a JavaScript primitive (a `str`, a small `int`,
// a `bool`) cannot key a WeakMap, and `"hello".upper` read twice is two method
// objects over one value. Two equal primitives are one receiver, so they are
// keyed by value.
//
// The wrapper is the one thing held weakly. The operation outlives everything
// (it is the native method's own record), so a WeakMap keyed on it kept every
// wrapper ever made, and the map keyed on the value kept every string. A
// wrapper lives as long as a consumer holds it; once it is collected, its entry
// is removed, and the value's map with its last entry.
const VALUE_RECEIVERS = new Map();

const COLLECTED = new FinalizationRegistry(({ self, origin, ref }) => {
    const byOrigin = VALUE_RECEIVERS.get(self);

    // Only the entry this wrapper made: a later read may have put a new one
    // under the same pair before the old wrapper was collected.
    if (byOrigin === undefined || byOrigin.get(origin) !== ref) return;

    byOrigin.delete(origin);
    if (byOrigin.size === 0) VALUE_RECEIVERS.delete(self);
});

const valueReceiver = (self) => ({
    get(origin) {
        return VALUE_RECEIVERS.get(self)?.get(origin)?.deref();
    },
    set(origin, wrapped) {
        let byOrigin = VALUE_RECEIVERS.get(self);

        if (byOrigin === undefined) {
            byOrigin = new Map();
            VALUE_RECEIVERS.set(self, byOrigin);
        }

        const ref = new WeakRef(wrapped);

        byOrigin.set(origin, ref);
        COLLECTED.register(wrapped, { self, origin, ref });
    }
});

function perReceiver(self) {
    if (self === null || (typeof self !== 'object' && typeof self !== 'function')) {
        return valueReceiver(self);
    }

    let cache = RECEIVERS.get(self);

    if (cache === undefined) {
        cache = new WeakMap();
        RECEIVERS.set(self, cache);
    }

    return cache;
}

// A JavaScript function a Python module reached for, named in `__js__`, or
// imported by the component's own `<script module>`. Python calls it with Python
// values, and the one JavaScript genuinely cannot use is a Python callable: it
// refuses arguments it never declared and answers in Python objects.
//
// So every callable argument crosses the boundary the way an exported function
// does. That is what makes `query(accepted)` in Python read exactly like
// `query(accepted)` in TypeScript: no wrapper for the author to remember.
// A proxy rather than a wrapper function, because the name has to stay the thing
// it was: its own properties, its prototype, `instanceof`, and construction with
// `new` all still reach the original. Only a call made through it is adapted.
//
// The two directions are the same crossing an exported function makes, in
// reverse: a callable becomes JavaScript-callable, a list, a tuple, a dict, a
// set and an instance of the author's cross as their view (`viewOf`), and a
// scalar as JavaScript's own. `fail(400, {"missing": True})` reaches
// JavaScript as an object it can read and serialise, not as a Brython dict
// full of symbols, and `chart.update(rows)` hands the library the list Python
// goes on appending to, as a JavaScript caller hands it its array. A view is a
// proxy, which `structuredClone` refuses, as it refuses Svelte's `$state`:
// `postMessage(to_js(rows))` hands it a copy, as `$state.snapshot` does.
//
// A callable at any depth is the view's to adapt when it is read, and
// `pyHandler` caches by function, so the same callback nested twice is one
// JavaScript function and stays removable. One view per container, so
// `alias(shared, shared)` hands JavaScript one object for one Python list, and
// a view handed back is its container again: `back(rows) is rows`.
//
// `None` as an argument is `undefined`, the engine's pairing, so a parameter
// with a default takes it whichever way the function was imported; inside a
// container it is `null`, which is what JSON writes for it.
const outbound = (value, made) => {
    if (value === NONE) return undefined;
    if (callable(value)) return pyHandler(value);

    const view = viewOf(value);

    return view === value ? plainData(value, made, pyHandler) : view;
};

// And what comes *back*: a value returned by an `importjs` function is Python's,
// as the same call written `js.Math.sqrt(2)` gives a Python float, so
// `cubicOut(0.5)` can be rounded, formatted and multiplied.
//
// `jsobj2pyobj` is that machinery: a number becomes an int or a float, a string
// a Python string, a DOM node a DOMNode, and plain objects and Promises are
// returned untouched, so a result handed straight back to JavaScript crosses
// unchanged and an awaited promise still awaits.
//
// A function is the exception: it becomes the adapter a named import is, so
// `factory()(0.25)` is called as `decimal(0.25)` is, its numbers and callbacks
// converted. `jsobj2pyobj` would build a Python-callable object around it
// instead, which reads no mark and gives none back. The adapter forwards every
// property, and going back out to JavaScript it is the function itself again
// (`pyHandler`): SvelteKit's `query()` returns a function carrying `__.type`,
// and `accepted = query(_accepted)` in a `.remote.py` exports the object
// SvelteKit built.
const inbound = (value) =>
    typeof value === 'function' ? jsCall(value) : (bytesIn(value) ?? globalThis.__BRYTHON__.jsobj2pyobj(value));

// **Brython's own refusal, which this proxy was going around.**
//
// A keyword call to a JavaScript function is undecidable (`foo(y=1, x=2)` on
// `function foo(x, y)` cannot be placed, because a JavaScript function carries
// no parameter names), and Brython raises `TypeError: A Javascript function
// can't take keyword arguments` for exactly that reason, in `pyargs2jsargs`.
//
// A call through this proxy never reaches that path: the keywords arrive as one
// extra **positional** argument, an object carrying them under Brython's symbol
// `$B.KW`. The decision is Brython's, and this restores it.
//
// The helpers are the other half of the same question and the opposite answer:
// their names are ours, so `helpers.js` places them. See `KEYWORDS` there.
// **And an empty one is removed, not merely accepted.** `f(1, **{})` is a
// perfectly ordinary Python call, and Brython still sends the carrier, which
// would be an extra **positional** argument: a variadic function would count
// two, and a parameter with a default would receive an internal object.
const withoutKeywords = (target, args) => {
    const $B = globalThis.__BRYTHON__;
    const keywords = args[args.length - 1]?.[$B.KW];

    if (keywords === undefined) return args;

    if ($B.keyword_is_empty(keywords)) return args.slice(0, -1);

    throw pyError(
        $B.$call($B.builtins.TypeError, `A Javascript function can't take keyword arguments`),
        `${target.name || 'a JavaScript function'}()`
    );
};

// One adapter per function, for the life of the function.
//
// The binding is read afresh on every access (a `let` in a `<script module>`
// is a *binding* and not a value), and without this a name read twice
// would hand Python two different proxies for one function. A registry given
// the first cannot remove the second: `off(handler)` after `on(handler)` is the
// shape that breaks, and it is the same identity rule `pyHandler` keeps on the
// other side of the boundary.
const ADAPTED = new WeakMap();

// The adapters themselves, which convert what they are called with, each with
// the function it adapts: what goes back out to JavaScript.
const ADAPTERS = new WeakMap();

// The call itself, Python's arguments out and JavaScript's answer back. The
// memo is made here, so it lasts exactly one call: a longer-lived one would hand
// a later call the snapshot an earlier one took, after Python had moved on.
const crossing = (target, self, args) => {
    const given = withoutKeywords(target, args);
    const made = new WeakMap();
    const converted = given.map((one) => outbound(one, made));

    flushExports();

    return inbound(Reflect.apply(target, self, converted));
};

export function jsCall(value) {
    // An imported constant crosses here too, and it crosses once, as the same
    // value returned by an imported *function* crosses through `inbound`:
    // `export const half = 0.5` is a float, which `format(half, ".2f")` takes.
    // A namespace, a default export or an object crosses as it is: the
    // functions reached through it are the engine's to call, and the engine
    // hands Python callables over through `pyobj2jsobj_hook`, above `pyHandler`.
    if (typeof value !== 'function') return pyBind(value);
    if (ADAPTERS.has(value)) return value;

    const known = ADAPTED.get(value);

    if (known !== undefined) return known;

    const adapted = new Proxy(value, { apply: crossing });

    ADAPTED.set(value, adapted);
    ADAPTERS.set(adapted, value);

    return adapted;
}

// One value of an exported mapping.
//
// The callable half asked `typeof one === 'function'`, which is the test the
// argument boundary had already stopped using: a bound method is an object, so
// `actions = {"default": handler.save}` handed JavaScript something it could not
// call, while `{"default": save}` beside it worked. The recognition is shared
// now; what stays local is the position, `module.key`, which is what a
// diagnostic from a form action should name.
//
// A plain function keeps the wrapper it had, arity included, so nothing changes
// for the mappings that already worked. A bound method takes its receiver and
// the arity of its own signature, `self` not counted.
// The rule an export carries, and the only one: a Python callable becomes a
// JavaScript one, everything else is left to the walk that meets it.
//
// It is a value rather than a branch because it has to travel. `plainData`
// invokes it on a callable at any depth, so handing it over is what makes
// `{"handlers": [Handler(db)]}` mean the same as `[Handler(db)]`. A function
// JavaScript built answers null to `declared` and comes back untouched, which is
// what keeps a library's own marks on it.
function exported(one, made) {
    // `pyHandler`, which is what the *argument* boundary asks for the same
    // question, rather than a wrapper of this site's own.
    //
    // A label is a per-site value, so a label woven into the wrapper would
    // build a **new function for one Python callable** at every conversion.
    // The callable's own label, `save() — src/app.py`, names the function that
    // raised, which is the one a traceback wants.
    //
    // `pyHandler` answers `one` itself when `declared` finds no signature, which
    // is a function JavaScript built: it crosses as data, which is to say as
    // itself.
    const wrapped = pyHandler(one);

    if (wrapped !== one) return wrapped;

    // Data, and the rule goes down with it.
    //
    // The rule goes down into a dict as into a list, so
    // `{"handlers": [Handler(db)]}` crosses its callables as `[Handler(db)]`
    // does: callables under a name is the shape a registry takes.
    return plainData(one, made, pyHandler);
}

// The exports to take again before JavaScript reads them (`liveExport`), run
// where Python hands JavaScript the hand: a call of a Python function returning
// (`pyCall`, `pyEvent`, `running`), a JavaScript function Python calls
// (`crossing`), and a microtask behind them, for a coroutine that hands it
// over at an `await`.
const STALE = new Set();
let staleQueued = false;

const flushExports = () => {
    if (STALE.size === 0) return;

    const due = [...STALE];

    STALE.clear();
    for (const one of due) one();
};

const markStale = (refresh) => {
    STALE.add(refresh);

    if (staleQueued) return;

    staleQueued = true;
    queueMicrotask(() => {
        staleQueued = false;
        flushExports();
    });
};

// A write from Python to a name `__js__` or `importjs` brings: refused, as
// JavaScript refuses an assignment to an import, with the name and the file.
export function readOnlyImport(name, where) {
    const $B = globalThis.__BRYTHON__;

    $B.RAISE(
        _b_.TypeError,
        `'${name}' is a JavaScript import of ${where}, and an import is read-only; ` +
            `bind another name to hold a value of your own`
    );
}

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
        if (stale.held !== undefined || (pyBytes(value) && mutableBytes(value))) track(value, stale, () => {});
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

// A value a module exports. A dict of functions, which is what SvelteKit's
// `actions` is, becomes an object of *wrapped* functions, so a form action gets
// the same boundary treatment as a `load()`. Anything else is plain data.
export function pyExport(value, where) {
    // A function published under a second name. The compiler hands the module's
    // `def`s over itself and its *values* here, and `alias = original` is a
    // value, which crosses as the function it is, an `async def` started.
    //
    // Asked as `declared`, which reads the signature Python recorded, and not as
    // `callable`: a function JavaScript built and a Python name published,
    // `accepted = query(_accepted)` in a `.remote.py`, must cross as the object
    // its library made, marks included. `declared` answers null for it, and
    // the adapter Python held it through gives it back.
    if (declared(value) !== null || ADAPTERS.has(value)) return exported(value);

    if (value === null || typeof value !== 'object') return value;

    // A callable that is not a `def` arrives here, because the compiler hands
    // over the module's *values* and `top = handler.run` is a value, not a
    // function of the module. It is the same bound method the mapping branch
    // below adapts, and whether a callback is adapted cannot depend on where it
    // was written.
    if (callable(value)) return exported(value);

    // A list, a tuple or a dict crosses as its view, the one a prop and a
    // context hand a JavaScript reader (`viewOf`): the module's own container,
    // so `items.append(2)` in Python is `[1, 2]` to the importer, as an
    // `export let items` pushed to is in JavaScript and `m.items` is in Python.
    // A copy followed only the name, and the container moved on without it. A
    // callable inside is adapted where it is read, at any depth, so a registry
    // of handlers, SvelteKit's `actions` among them, calls as it did.
    const view = viewOf(value);

    if (view !== value) return view;

    // A class crosses as itself. `plainData` walks whatever it is given and
    // hands back the attributes it found, which for a class is `__doc__`,
    // `__qualname__`, `__dict__` and the methods: neither the class nor an
    // error, and the one shape here that was a lie rather than a limit.
    //
    // Handing it over untouched is the truth about the boundary. What arrives
    // is a Brython class object, so `typeof` is `object` and neither `W(3)` nor
    // `new W(3)` reaches it; what does is `$B.$call(W, 3)`, which runs
    // `__init__` and returns an instance, and giving the object back to Python,
    // which is what the `PYOBJ` WeakMap exists for. Wrapping it in a JavaScript
    // constructor so `new W(3)` worked is a thing this boundary could do and
    // does not: it would be an addition, not a repair.
    //
    // Refusing the spelling instead would impose a JavaScript limit on Python:
    // `__all__` is *Python's* declaration of what a module exports, read by
    // `from m import *` before anything of ours reads it.
    // Recognised by shape, the way the rest of this file recognises Brython's
    // own objects: a class carries `tp_name` and `tp_bases` beside its
    // `ob_type`, which no instance and no dict does.
    if (pyClass(value)) return value;

    // Anything else is plain data. A JavaScript object carrying a callback as
    // a field, `this.callback = () => …` or a literal of functions, is
    // JavaScript's and crosses as itself, by the rule `plainData` follows
    // (`javascriptOwn`), its accessors unread.
    return plainData(value, undefined, pyHandler);
}

// A component's own function, as Svelte and the DOM call it.
//
// The third of the three wrappers, here beside the other two, so that a rule
// added to one, the argument conversion for one, reaches all three.
//
// `call` is handed the arguments rather than the wrapper reading them, because
// what an expression function does with them differs (it takes its values
// already Python), and that difference is the compiler's to write.
//
// The result goes through `pyNumbers`, not `plainData`: what a component hands
// the *framework* is a transition's options or an action's teardown, and a
// Brython float there is an object `Element.animate` refuses. A coroutine is
// fired and not awaited, since nobody reads what a handler returns.
// `convert` null is for a value that goes back into Python rather than out to
// the framework, and is handed back as it is: made a JavaScript number, a float
// would come back to Python a `JSObject`.
const running = (call, where, convert = pyNumbers) => {
    try {
        const result = call();
        const value = schedule(result, where, convert ?? undefined);

        // A coroutine's promise converts what it resolves to, above; the
        // promise itself is handed back as it is.
        return convert === null || value !== result ? value : convert(value);
    } catch (error) {
        throw pyError(error, where);
    } finally {
        flushExports();
    }
};

// The arity is read at the call, from the value the name holds then: `@export`
// above another decorator publishes a name whose value is not the `def`, and a
// `@collect` answering a `*values` function takes every argument. The name a
// `def` was given is no claim about what is behind it.
//
// The call goes through what `declared` hands back rather than through the name
// directly, which is the other half: a decorator that answers a **callable
// instance** is called perfectly well by Python and is not a JavaScript
// function.
//
// What stays different from a module's export is the result: a component hands
// the *framework* a transition's options or an action's teardown, so
// `pyNumbers` and not `plainData`. That difference is why this wrapper exists
// at all. A callable returned whole is a callback like one returned inside a
// config.
const returned = (value) => (callable(value) ? pyHandler(value) : pyNumbers(plainScalar(value)));

// What an `@export` hands the parent that calls it through `bind:this` is data,
// the instance's API and not a framework's options, so it crosses as a prop's
// value does (`bound`): a list or a dict as its live view, which a JavaScript
// reader follows and writes, rather than the Brython object with its internals.
const published = (value) => pyNumbers(__pybridge.bound(value));

export const pyComponent = (read, where, exported = false) => {
    const first = declared(read());

    return identified(
        (...args) => {
            const value = read();
            const found = declared(value);
            const given = taken(args, found === null ? Infinity : found.arity);

            return running(
                () => (found === null ? value(...given) : found.fn(...given)),
                where,
                exported ? published : returned
            );
        },
        nameOf(where),
        first === null ? 0 : arityNow(first.arity)
    );
};

// What a store hands JavaScript for one of its names: the value the name holds
// when it is read, for what it is, whatever bound the name. A Python callable
// crosses as the store's own functions do, through `call` when the name is a
// `def` and has its wrapper, through one made once per callable otherwise;
// anything else as `plainScalar` hands it.
const STORE_CALLS = new WeakMap();

export function storeMember(value, where, call) {
    if (declared(value) === null) return plainScalar(value);
    if (call !== undefined) return call;

    let wrapped = STORE_CALLS.get(value);
    if (wrapped === undefined) STORE_CALLS.set(value, (wrapped = pyComponent(() => value, where)));

    return wrapped;
}

// And the other half of the same wrapper: a function the *markup* compiled, one
// per expression it met.
//
// What separates it from the one above belongs to the template rather than to
// the boundary: its arguments are a block's own name, a snippet's parameter,
// and no container is converted. A scalar may still be JavaScript's, the value
// a JavaScript promise resolved to in `{#await}`: `pyBind` makes it Python, a
// fractional number a float and an absence None, and leaves a Python value as
// it is.
//
// Two names rather than a flag, so the compiler *chooses* a wrapper instead of
// describing one: what it writes is a name, and everything a crossing does is on
// this side of the line.
//
// `kept` is true for a value that stays Python, and names how a binding
// compares one: `'scalar'`, a scalar made JavaScript's and a container handed
// over as the object it is, since a copy is another object to `===`; and
// `'selection'`, the list a `<select multiple>` looks each option's value up
// in, whose items are made so one by one, in a new array, the list left as it
// is.
const scalarOnly = (value) => {
    if (value === null || typeof value !== 'object') return value;
    const alone = pyScalar(value);
    return alone === undefined ? value : alone;
};

const COMPARED = {
    scalar: scalarOnly,
    selection: (value) => (Array.isArray(value) ? value.map(scalarOnly) : scalarOnly(value))
};

//
// `rendering` counts the template expressions running: whatever Python runs
// inside one, a lambda or a generator it drives, runs while the template
// renders, and a handler a click calls later does not, nor the write half of a
// binding, `writes`, which an input event calls.
let rendering = 0;

export const pyExpression = (call, where, arity, kept = false, writes = false) =>
    identified(
        (...args) =>
            running(
                () => {
                    const counted = writes ? 0 : 1;

                    rendering += counted;
                    try {
                        return call(args.slice(0, arity).map(pyBind));
                    } finally {
                        rendering -= counted;
                    }
                },
                where,
                kept === true ? null : (COMPARED[kept] ?? pyNumbers)
            ),
        nameOf(where),
        arity
    );

// **A name of the module that nothing has bound yet**, assigned in a branch
// that did not run, or deleted, is read by Python code as CPython reads it,
// `NameError` (`$B.resolve_in_scopes`, where a read the namespace no longer
// answers goes), and by the template as Svelte renders a value that is not
// there: empty.
//
// The template is the text between its braces, the way the dot is: a read is
// the template's when the code making it is written there, a lambda or a
// generator written between the braces included, and runs while the template
// renders. The functions the markup pass compiles follow the script in the
// module's source, so the line being run says where it is written: from the
// first of them on, `templateFrom` registers per file. And `rendering` says
// whether the template is rendering: a handler written in the template runs on
// a click, outside it, and reads as Python does, as does a function of the
// script the expression calls, whose `except NameError` is taken whoever called
// it.
//
// What the template reads is None, what JavaScript's `undefined` becomes
// wherever it enters Python: rendered empty, `None` in an f-string, and the
// `TypeError` Python raises for `total + 1`, at its line.
const TEMPLATE_LINES = new Map();

export const templateFrom = (file, line) => {
    TEMPLATE_LINES.set(file, line);
};

(function installTemplateAbsence($B) {
    const resolve = $B.resolve_in_scopes;
    const declares = (namespace, name) =>
        namespace !== null && typeof namespace === 'object' && namespace.$proxy === true && name in namespace;
    const templates = () => {
        const frame = $B.frame_obj?.frame;
        const from = frame === undefined ? undefined : TEMPLATE_LINES.get(frame.__file__);
        return rendering > 0 && from !== undefined && frame.$lineno >= from;
    };

    $B.resolve_in_scopes = function (name, namespaces, inum) {
        try {
            return resolve.call(this, name, namespaces, inum);
        } catch (error) {
            if (templates() && namespaces.some((one) => declares(one, name))) return NONE;

            throw error;
        }
    };
})(globalThis.__BRYTHON__);

// **A directive is a call whose callee is a Python expression.** The markup pass
// writes `use:act.measured={v}` as `use:__directiveAction={["act.measured",
// act.measured, v]}`: Svelte calls one function of this file, by a name that is
// always there, and the head and the value are compiled like any template
// expression, by the template's rules, in the scope they are written in. So a
// name of the script, an import under any spelling, a name the markup declared,
// a snippet's parameter and a dotted path through an instance or a dict all
// reach the same place, and a JavaScript name is read when the directive runs.
//
// What is called decides the conversion, since the value is Python:
//
//   a Python callable   the value as it is, through the wrapper of the
//                       component's own functions: the receiver bound, the
//                       arity trimmed, an `async def` started, an error placed
//   anything else       a JavaScript function, reached through a wrapper that
//                       converts the value at every depth, as `importjs` does
//
// What a JavaScript action hands back is not wrapped: its `update` is a bare
// function, and Svelte gives it the value again, so it is converted there.
//
// And Svelte's own protocol, read in its sources, is kept whole around the
// payload, since the payload is what Svelte now sees:
//
//   use:          fn(node, value)                 value as given; the result's
//                                                 `update` and `destroy` are
//                                                 called as its methods
//   transition:   fn(node, params ?? {}, opts)    an absent or None value is
//                                                 an empty one; the result is a
//                                                 config, or a function Svelte
//                                                 calls later for the config
//   animate:      fn(node, {from, to}, params)    value as given; same results
//
// Memoised per function, so two directives naming one callable share one
// wrapper.
const directives = new WeakMap();

const directiveCall = (where, fn, args) => {
    if (declared(fn) !== null) return { python: true, result: directiveCallable(fn, where)(...args) };

    if (typeof fn !== 'function') {
        throw new TypeError(`svelthon — the directive \`${where}\` names ${String(fn)}, which is not callable`);
    }

    // The adapter `importjs` publishes converts what it is called with, and is
    // handed the arguments as they are; any other JavaScript function, one a
    // prop brought among them, is handed them converted.
    return { python: false, result: fn(...(ADAPTERS.has(fn) ? args : forJavaScript(args))) };
};

// What a JavaScript function is handed by a directive: a Python value converted
// as an imported function's argument is, by `outbound` with one memo for the
// call, and Svelte's own values, a node, the options and the rects, as they
// are. Told apart by the descriptors and, for a function, by its signature, so
// nothing of the author's is read.
const forJavaScript = (args) => {
    const made = new WeakMap();

    return args.map((one) =>
        quietPyType(one) !== undefined || (typeof one === 'function' && declared(one) !== null) ? outbound(one, made) : one
    );
};

// Svelte's `safe_not_equal`, asked of what the action is handed. A Python
// float is an object, and would always count as changed where the number it
// stands for does not. To a JavaScript action every scalar is handed as its
// number or its string; to a Python action only a float, an int or a str is,
// and an instance of a subclass is itself, an object with fields of its own,
// which a new one may change. A container always counts, as an object does.
const PLAIN_SCALARS = [_b_.float, _b_.int, _b_.bool, _b_.str];
const changed = (before, after, python) => {
    const handed = (value) => {
        if (value === NONE) return undefined;
        const scalar = pyScalar(value);
        return scalar === undefined || (python && !PLAIN_SCALARS.includes(ownType(value))) ? value : scalar;
    };
    const a = handed(before);
    const b = handed(after);

    // eslint-disable-next-line no-self-compare
    return a != a ? b == b : a !== b || (a !== null && typeof a === 'object') || typeof a === 'function';
};

// What an action hands back keeps the shape Svelte reads, and its `update` is
// given the value alone: Svelte passes the whole payload again, and the payload
// is a new array on every run, so Svelte's own comparison always answers yes.
// It is made here instead, on the value, and an action written without one is
// never updated, nor its `update` read, as Svelte reads it only when there is a
// value. Both are called on the result, as Svelte calls them, so a method
// reading `this` finds it. A function is a result like an object, since Svelte
// reads the two methods off whatever it is handed.
//
// `update` answers the value, and nothing else it reads: run in Svelte's
// effect, a log it appends to would subscribe that effect to the log, and
// each append would update the action again, a value that is an object always
// counting as changed.
const actionPayload = (python, result, given) => {
    if (result === null || (typeof result !== 'object' && typeof result !== 'function')) return result;

    let held = given[0];

    return {
        update:
            given.length && typeof result.update === 'function'
                ? ([, , ...next]) => {
                      if (!changed(held, next[0], python)) return;

                      held = next[0];
                      untrack(() => result.update(python ? held : forJavaScript([held])[0]));
                  }
                : undefined,
        destroy: typeof result.destroy === 'function' ? () => result.destroy() : undefined
    };
};

// `use:`, called `(node, payload)`. The head is a thunk, read once here, when
// Svelte installs the action: had it been part of the value, a new callee would
// have counted as a new value and called `update`. Svelte calls an action
// optionally, so an absent one installs nothing.
export function directiveAction(node, [where, head, ...value]) {
    const fn = head();

    if (fn === undefined || fn === null || fn === NONE) return undefined;

    const { python, result } = directiveCall(where, fn, [node, ...value]);

    return actionPayload(python, result, value);
}

// `transition:`, `in:` and `out:`, called `(node, payload, options)`. Svelte
// gives `params ?? {}`, and the payload is never absent, so the empty value is
// supplied here: a dict for Python, an object for JavaScript, whose own
// transitions destructure it.
export function directiveTransition(node, [where, head, ...value], options) {
    const fn = head();
    const given = value.length ? value[0] : undefined;
    const params =
        given !== undefined && given !== null && given !== NONE
            ? given
            : declared(fn) !== null
              ? globalThis.__BRYTHON__.empty_dict()
              : {};

    return directiveCall(where, fn, [node, params, options]).result;
}

// `animate:`, called `(node, { from, to }, payload)`, the payload's place kept
// when the directive gives none, as Svelte keeps it: `undefined` to JavaScript,
// None to Python. An action's is not, and Svelte calls a bare one with the node
// alone.
export function directiveAnimate(node, rects, [where, head, ...value]) {
    return directiveCall(where, head(), [node, rects, value.length ? value[0] : undefined]).result;
}

// What a directive hands back, read by Svelte: an action's `update` and
// `destroy`, a transition's `duration` and `tick`. A dict holds them as entries
// and `pyNumbers` adapts those. An **instance** holds them as methods of its
// class, which no walk of its own properties finds: `return Lease(node,
// value)` would mount and never update nor clean up. Its view reads each
// name through the attribute protocol when Svelte asks, and answers `undefined`
// for one it does not have, which is how Svelte asks whether there is one.
//
// A **Python callable** handed back is a deferred transition: Svelte calls it
// later for the config. It is wrapped like the directive's own callee, so its
// arguments are converted and its config comes back through this same rule. A
// callable instance is asked first, before it is taken for a config object.
// And it is read like an instance all the same: an action's result that is a
// function carrying `update` and `destroy`, or an instance with `__call__`,
// still hands Svelte both, which it reads off whatever it is handed.
function directiveResult(value, where) {
    const called = declared(value) !== null;
    const instance =
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        pyClass(ownType(value)) &&
        pyScalar(value) === undefined &&
        !globalThis.__BRYTHON__.is_dict(value);

    if (!called && !instance) return pyNumbers(value);

    // Read when Svelte asks, after the directive has returned, so what a
    // property raises is relayed here, as under a view (`relayed`). What the
    // function Svelte calls has of its own is its own.
    return new Proxy(
        called ? directiveCallable(value, `${where} result`) : Object.create(null),
        relayed(
            {
                get(target, key) {
                    if (key in target) return Reflect.get(target, key);
                    if (typeof key === 'symbol') return undefined;

                    const found = globalThis.__BRYTHON__.$getattr(value, key, MISSING);

                    if (found === MISSING || found === NONE) return undefined;

                    return callable(found) ? pyHandler(found) : pyNumbers(found);
                }
            },
            `${where} result`
        )
    );
}

// Callable in Python, which is the question every boundary that promises to
// adapt a callback asks, and `typeof` cannot answer: `fade = Fades(0.3).run`,
// an object configured once, its method named by the directive, is callable,
// and so are a callable instance and a classmethod.
function directiveCallable(member, path) {
    const found = declared(member);

    if (found === null && typeof member !== 'function') return member;

    let wrapped = directives.get(member);

    if (wrapped === undefined) {
        // Trimmed to the arity Python declared, exactly as a handler is: Svelte
        // calls a transition `fn(node, params, options)`, and `def
        // typewriter(node, params)` refuses the third.
        //
        // `declared` reads the receiver, the signature, and
        // leaves `self` out of the arguments, for every shape. It answers null
        // for a function JavaScript built, which keeps the reading it always
        // had: no signature, so no trim.
        const called = found === null ? member : found.fn;
        const arity = found === null ? Infinity : found.arity;
        const where = found === null ? `${path}()` : found.where;

        // Converted on the way in, like every other call boundary: Svelte hands
        // an action or a transition its JavaScript values, and a fractional one
        // reaching `format(value, '.2f')` must be a float. A DOM node is left
        // alone by `pyArg`, which is what the first argument always is here.
        // Run through `running`, the wrapper of a component's own functions: an
        // `async def` is started, and an error placed.
        wrapped = identified(
            (...args) =>
                running(() => called(...taken(args, arity)), where, (value) => directiveResult(value, where)),
            nameOf(where),
            arityNow(arity)
        );

        directives.set(member, wrapped);
    }

    return wrapped;
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
    if ($B.$svelthonImports) return;
    $B.$svelthonImports = true;

    const engine = $B.$__import__;

    $B.$__import__ = function (name, ...rest) {
        const waiting = WAITING.get(name);

        if (waiting !== undefined) untrack(waiting);
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
// read no cell. Each name it holds is kept as held at its source, so nothing is
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

        const value = heldAtSource(namespace, name);

        if (computed?.has(name)) {
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
        if (locals !== namespace || namespace.$svelthonStarred === undefined || !Array.isArray(names) || !names.includes('*')) {
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
// component's own list, which the compiler hands over on the prototype.
function starred(namespace, name) {
    const proto = Object.getPrototypeOf(namespace);

    // Only the generated namespace's own prototype is ours to write on.
    if (proto === null || proto === Object.prototype) return;

    const { owner } = namespace.$svelthonStarred;
    let update;
    const changed = createSubscriber((one) => {
        update = one;

        return () => {
            update = undefined;
        };
    });
    const bump = () => update?.();
    let held = track(namespace[name], bump, changed, owner);

    delete namespace[name];

    bind(
        proto,
        name,
        () => (changed(), held),
        (value) => {
            held = track(value, bump, changed, owner);
            bump();
        },
        () => held
    );
}

// `pep.title` inside the markup, on a dict.
//
// A template's expressions already differ from the same text in the script: a
// `{#if}` goes through `__truthy` so an empty list is false the Python way, an
// interpolation through `__text` so a list renders `['a', 'b']`, an iterable
// through `__seq`, a spread through `__spread`. The dot joins them: it finds an
// attribute, and failing that a key, which is what Jinja does with `foo.bar` and
// what anyone arriving from Django or Flask already expects.
//
// Attribute first, so a dict's real methods keep winning: `{d.items}` is the
// method, not a key called "items". And a name that is neither raises the
// AttributeError it always did. The fallback never turns a typo into silence,
// which is the one place Jinja is weaker, its `Undefined` rendering nothing.
//
// It is a rule of the template's **text**: the compiler rewrites every dot
// written in the markup into a call to this, so a function of the script that a
// template calls keeps plain Python, and a lambda written in the template keeps
// the rule when it runs later, on a click.
const MISSING = Symbol('svelthon.missing');

// A module namespace object: no prototype, and the tag `Module` as a data
// property of its own, which a module's exports cannot replace.
const moduleNamespace = (value) =>
    value !== null &&
    typeof value === 'object' &&
    Object.getPrototypeOf(value) === null &&
    Object.getOwnPropertyDescriptor(value, Symbol.toStringTag)?.value === 'Module';

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
        const keys = new Set(
            Array.from(taken, (key) => {
                const spelt = $B.pyobj2jsobj(key);
                return typeof spelt === 'symbol' ? spelt : String(spelt);
            })
        );

        for (const key of Reflect.ownKeys(row)) {
            if (keys.has(key) || !Object.prototype.propertyIsEnumerable.call(row, key)) continue;

            $B.$setitem(out, key, $B.jsobj2pyobj(row[key], row));
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
const javaScriptRow = (row) =>
    row !== null && (typeof row === 'object' || typeof row === 'function') && quietPyType(row) === undefined;

// What `**` takes of a Python value in the markup, a rest or a spread alike: a
// mapping's entries, and otherwise an object's attributes, what `vars(value)`
// holds, where Python's own `{**value}` refuses. A value with neither is
// refused with the sentence `{**value}` raises, about the `**` the author
// wrote: None, a str, an int, an instance of a class with `__slots__`.
const starredEntries = (value) => {
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

// `otherwise`, when given, is a callable whose result stands for a name that is
// neither: the default of a key in a pattern, `{#each rows as {id=0}}`.
export function readAttr(target, name, otherwise) {
    const $B = globalThis.__BRYTHON__;

    // A JavaScript record whose own data has a field called `ob_type`: the
    // engine reads that field to know what an object is, takes `"business"` for
    // a class, and fails inside its attribute lookup. It is data, the rule every
    // other boundary of this file applies, so its member is read as JavaScript
    // and handed over the way the engine hands over any JavaScript member.
    if (
        target !== null &&
        typeof target === 'object' &&
        Object.hasOwn(target, 'ob_type') &&
        !pyClass(quietly(target, 'ob_type')) &&
        !$B.is_dict(target)
    ) {
        if (name in target) return $B.jsobj2pyobj(target[name], target);
        if (otherwise !== undefined) return $B.$call(otherwise);

        $B.RAISE(_b_.AttributeError, `'${name}'`);
    }

    // A function a module's namespace exports, `importjs * as callbacks`, is the
    // function the same import by name gives: `jsCall`'s adapter, which hands
    // the call the receiver it is called with. Read as the engine reads any
    // object's member, it would be bound to the namespace, and
    // `onclick={callbacks.receiver}` called with it where Svelte hands the
    // element.
    if (moduleNamespace(target) && typeof target[name] === 'function') return jsCall(target[name]);

    // With a default, so a miss costs no exception: building one on every field
    // read of every dict would be the whole cost of this feature.
    const found = $B.$getattr(target, name, MISSING);
    if (found !== MISSING) return found;

    const item = lookup(target, name);
    if (item !== MISSING) return item;

    // No such key either: the default, or the real lookup, which raises.
    return otherwise === undefined ? $B.$getattr(target, name) : $B.$call(otherwise);
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
function lookup(target, name) {
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

// Whether the dot should write a key rather than an attribute: the object has
// one of that name.
//
// **The probe and the write are two statements.** An exception raised by the
// author's own `__setitem__` is not a reason to write somewhere else, and
// neither is one raised by their `__getitem__` while the key is looked for:
// `lookup` lets both go on. Once the key is found the destination is decided.
const keyed = (target, name) => lookup(target, name) !== MISSING;

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
    if (handed !== null && Object.is(value, handed.js)) return handed.py;
    if (typeof value === 'number') return globalThis.__BRYTHON__.jsobj2pyobj(value);

    // A view a JavaScript reader was handed (`viewOf`) is its container again,
    // a function `pyHandler` published its callable, and a copy of bytes the
    // bytes it holds.
    if (VIEWED.has(value)) return globalThis.__BRYTHON__.PYOBJ_MAP.get(value);

    return PUBLISHED.get(value) ?? bytesIn(value) ?? value;
};

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
function attributed(target, name) {
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

// What a write through a dot of the template compiles to: `(obj.attr := value)`,
// which Python's own grammar refuses the walrus, and the write half of
// `bind:value={row.label}`. And `(obj[key] := value)` beside it.
//
// The write half of `readAttr`: an existing key wins over an attribute, so the
// write lands where the read came from. Only an *existing* key: what a missing
// one should do is still open, so it keeps Python's own answer.
//
// They return the value, as an assignment expression must, so that a group can
// hold several and `{count}` still reads afterwards.
export function writeAttr(target, name, value) {
    const $B = globalThis.__BRYTHON__;

    if (!attributed(target, name) && keyed(target, name)) {
        // Outside the `try`, for the reason written above `keyed`.
        $B.$setitem(target, name, value);

        return value;
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
// instead: a directive whose value *is* Python, like every other one.
//
// The group then needs no identity at all. Each input computes its own `checked`
// from the same target, so exactly one radio stays filled and rows of an
// `{#each}` keep their own answer, both of which Svelte's own machinery gets
// wrong here for want of a notification.
//
// The element's `type` is read off the node, and so is its value, as Svelte
// last set it rather than as the DOM holds it: a DOM value is text, so
// `value={1}` reads back as "1", where the author's data holds the number `1`.
// Svelte keeps the value it was handed: on `__value` for a spread, in the cache
// `set_value` writes for `value={x}` and `{value}`. A value written as text is
// the node's own text, which is what a plain HTML form hands over. Read there,
// the field and the group hold one value: Svelte has evaluated the expression
// once, and resolved a shorthand, a spread and their order. Compiled again for
// the group from the tag's text, an expression answering anew gave the group
// another value, and the shorthand and the spread were not seen at all.
// A form reset moves the controls without firing `change` on any of them, and a
// group answers it as Svelte's own `bind:group` does: the selection is emptied,
// `[]` for checkboxes and None for radios, and the controls follow the model.
//
// One listener for the whole document, in the capture phase so nothing can stop
// it, and the work done one microtask later, after the form has put its
// controls back: Svelte's own binding is built the same way.
const RESETS = new WeakMap();

let watching = false;

function watchReset() {
    if (watching || typeof document === 'undefined') return;

    watching = true;
    document.addEventListener(
        'reset',
        (event) => {
            queueMicrotask(() => {
                if (event.defaultPrevented) return;

                for (const one of event.target.elements) RESETS.get(one)?.();
            });
        },
        { capture: true }
    );
}

// Which group an input belongs to: the target its binding writes. Three things,
// and each one alone is wrong:
//
//   the instance   two instances of one component share the binding text, and
//                  may share the list they were handed
//   the binding    `left = shared` and `right = shared` are two bindings on one
//                  list, in one instance
//   the row        the rows of an `{#each}` are one binding and one target
//                  each, told apart by the template names the binding mentions
//
// The list a target currently holds is not one of them: two rows handed one
// default list are still two targets, and keying on the list merged them.
//
// The first two are stable for the life of the component, so they are folded
// into a token here; `targetOf` adds the row.
const GROUPS = new WeakMap();

// The target an input writes, held by the input and nowhere else. A registry of
// one object per tuple of mentioned values answered the same row with the same
// object on every render, and kept the string or the number of every row a
// long-lived form had ever shown, since nothing told it a row was gone.
const targetOf = (token, where) => ({ token, where });

// Two inputs write one target when they are of one token and their bindings
// mention the same values, compared the way a Map compares its keys: by
// identity, a NaN equal to itself.
const sameTarget = (a, b) =>
    a.token === b.token &&
    a.where.length === b.where.length &&
    a.where.every((one, i) => one === b.where[i] || (one !== one && b.where[i] !== b.where[i]));

function groupToken(scope, binding) {
    // No scope to share a token through: a token of its own, the one shape the
    // rest of `group` knows. The binding itself is a string, which holds no
    // property.
    if (scope === null || typeof scope !== 'object') return { binding };

    let bindings = GROUPS.get(scope);

    if (bindings === undefined) {
        bindings = new Map();
        GROUPS.set(scope, bindings);
    }

    let token = bindings.get(binding);

    if (token === undefined) {
        token = { binding };
        bindings.set(binding, token);
    }

    return token;
}

// Svelte's cache of what `set_value` was handed, under a symbol it does not
// export, found by its description on the first node that carries it.
let ATTRIBUTES;

const attributesOf = (node) => {
    ATTRIBUTES ??= Object.getOwnPropertySymbols(node).find((one) => one.description === 'attributes');

    return ATTRIBUTES === undefined ? undefined : node[ATTRIBUTES];
};

export function group(node, [current, write, chosen, fielded, binding, scope, where = []]) {
    const boxes = node.type === 'checkbox';
    const token = groupToken(scope, binding);

    node.$svelthonGroup = targetOf(token, where);

    // The value the markup pass compiled from the tag, and whether it was
    // written braced or as the shorthand, which Svelte writes typed. It is
    // also what makes the action update when the value changes, as Svelte's
    // own group reads its value with the model. `undefined` for a value that
    // is static text, which the node holds and nothing can move.
    let picked = chosen;

    // Read at each use, after Svelte has written the attributes of the turn: a
    // spread's value, its own or an attribute's it overrides, then a braced
    // value as the field evaluated it, then what the tag's text compiled to (a
    // lone interpolation keeps its type there, as in Svelte, where the field
    // holds its text).
    const value = () => {
        if ('__value' in node) return pyBind(node.__value);

        const written = fielded ? attributesOf(node) : undefined;

        if (written !== undefined && 'value' in written) return pyBind(written.value);

        return picked === undefined ? node.value : pyBind(picked);
    };

    // **A checkbox group is the checked inputs, read in the order they sit in
    // the document**, as Svelte's own binding reads them
    // (`get_binding_group_value` walks the group's inputs): ticking `b` then `a`
    // gives `['a', 'b']`, not the click history.
    //
    // So each input registers on the token, which is what already says *these
    // inputs belong together* across instances and `{#each}` rows, and the
    // collection is sorted by document position rather than by insertion: a
    // group whose rows are reordered is the case an insertion order would get
    // wrong in the same way, one level down.
    //
    // One array, as in Svelte's `bind_group`: an input joins it here and leaves
    // it at teardown, so nothing else keeps a destroyed control alive, and it is
    // sorted in place when the inputs registering in the same turn are all in
    // place, once per group and not once per input. Sorting at every collection
    // asked the document where a control was after a script had taken it out,
    // and the answer for a detached node is the engine's choice.
    const inputs = (token.inputs ??= []);

    inputs.push(node);
    node.$svelthonValue = value;

    if (!token.sorting) {
        token.sorting = true;

        queueMicrotask(() => {
            // DOCUMENT_POSITION_FOLLOWING alone: `b` comes after `a`.
            inputs.sort((a, b) => (a.compareDocumentPosition(b) === 4 ? -1 : 1));
            token.sorting = false;
        });
    }

    // **And the row is the third half of the identity**: the token is the
    // instance and the binding, and inside one `{#each}` every row shares both.
    // Collected on the token alone, the whole loop would be one group, and
    // ticking a box on the second row would write the first row's selection
    // into it as well.
    //
    // Membership is the registration, which `destroy` removes, and not being in
    // the document: a control taken out of the page by a script, or a component
    // mounted in a detached target, is still mounted, and Svelte's own group
    // keeps it until its teardown, rather than a ticked box leaving the
    // selection the moment it leaves the page. An input that
    // registered after the last sort is at the end until the next one runs.
    const inOrder = () => inputs.filter((one) => sameTarget(one.$svelthonGroup, node.$svelthonGroup));

    // Python's `==`, not JavaScript's `===`. A Brython float is an object
    // `{ob_type, value}`, so `value={0.5}` evaluated twice is two objects and
    // identity answers false for what the author wrote as one value. `==` and
    // `in` are also what a Python author reads in a group.
    // Python's comparison, read as Python reads it. Asking `=== true` of the
    // answer is a narrower question than the one that was asked: `__eq__` may
    // return anything, and `return int(self.n == other.n)` gives 1, true to
    // Python and not the JavaScript boolean.
    const alike = (one, mine) => {
        try {
            return __pybridge.truthy(globalThis.__BRYTHON__.rich_comp('__eq__', one, mine));
        } catch (error) {
            // An `__eq__` of the author's that raises is not a "no". The fall
            // back to identity is for a value Python cannot compare at all, a
            // foreign JavaScript one; for a failed protocol it would answer
            // *plausibly and wrongly*. Same rule as `__pybridge.truthy` one file
            // up.
            if (raised(error)) throw pyError(error, `bind:group={${binding}}`);

            return one === mine;
        }
    };

    const same = (one) => alike(one, value());

    // **A value goes into a group's list once.** Two controls may stand for one
    // choice (a form showing the same option in two sections), and Python
    // equality is what says they are one choice, since two Brython values that
    // are equal are rarely the same object.
    const include = (into, held) => {
        if (!into.some((already) => alike(already, held))) into.push(held);
    };

    // The model last shown, which a new value of the field is shown against.
    let model = current;

    const show = (held) => {
        model = held;
        node.checked = boxes ? Array.from(held ?? []).some(same) : same(held);
    };

    // Svelte writes a new value of the field in the same turn as the action
    // updates, and after it: the control follows each write, as Svelte's own
    // group follows its control's value. Read at the update, the field still
    // held the value before, and the control kept a state its value no longer
    // had.
    const followed = [];
    const follow = (owner, key) => {
        if (owner === undefined || !Object.hasOwn(owner, key)) return;

        let held = owner[key];

        Object.defineProperty(owner, key, {
            configurable: true,
            enumerable: true,
            get: () => held,
            set(next) {
                held = next;
                show(model);
            }
        });
        followed.push([owner, key]);
    };

    follow(node, '__value');
    if (fielded) follow(attributesOf(node), 'value');

    const changed = () => {
        if (!boxes) return write(value());

        // **Two controls may stand for one choice**, which is what a form does
        // when it shows the same option in two sections. Collecting each checked
        // input as an entry of its own put the value in twice, and unticking one
        // of them left the other checked, so the value came straight back and
        // the reader could not remove it.
        //
        // Svelte's own `get_binding_group_value` is these two lines: a `Set` of
        // the checked values, then a `delete` of the one whose control just went
        // off. Read here with Python's `==` rather than a JavaScript `Set`,
        // because two Brython values that are equal are rarely the same object.
        const picked = [];

        for (const one of inOrder()) {
            if (one.checked) include(picked, one.$svelthonValue());
        }

        const mine = value();

        // A checkbox group is a list, and it has to arrive as Python's: an array
        // built here reads as a JavascriptArray, which prints `[a, c]` where
        // Python prints `['a', 'c']` and refuses a slice.
        write(
            __pybridge.list(node.checked ? picked : picked.filter((one) => !alike(one, mine)))
        );
    };

    // What a reset writes: the empty selection, as Svelte's `bind:group` does.
    const restored = () => write(boxes ? __pybridge.list([]) : NONE);

    node.addEventListener('change', changed);
    RESETS.set(node, restored);
    watchReset();

    // A control the reader changed before the script ran, which is what a
    // page hydrated after a click looks like: it is no longer at its default.
    // The control wins, and the model is rebuilt from the group once its inputs
    // are all registered and in order, as Svelte's own `bind_group` does;
    // showing the model first would erase the click. A fresh mount makes the two
    // agree, so it shows the model as before.
    if (node.defaultChecked === node.checked) show(current);
    else queueMicrotask(() => (boxes || node.checked) && changed());

    return {
        update([next, , given, , , , moved = []]) {
            node.$svelthonGroup = targetOf(token, moved);
            picked = given;
            show(next);
        },
        destroy() {
            node.removeEventListener('change', changed);
            RESETS.delete(node);

            const at = inputs.indexOf(node);
            if (at !== -1) inputs.splice(at, 1);

            for (const [owner, key] of followed) {
                Object.defineProperty(owner, key, { value: owner[key], writable: true, configurable: true, enumerable: true });
            }
        }
    };
}

// A shared clock, for the values that go stale on their own. `fromnow` is the
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
// otherwise be set for months down to an hour, which never sleeps, and costs
// nothing.
const AT_MOST = 3600 * 1000;

let announce = null;
let armed = null;
let wanted = Infinity;

// `createSubscriber` hands `update` to a *render effect*, so it arrives on the
// next flush rather than on the line after the call. The delay asked for is
// therefore recorded first and armed whenever arming becomes possible: once
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
// derived's body run. It is what `del` watches; without one, `get` is it.
const STORED = new WeakMap();

// The names whose reading computes what they hold, a derived's: what a failed
// module keeps of one is its definition, still computed when read.
const COMPUTED = new WeakMap();

// What a namespace holds under `name`, asked at its source: a derived's
// definition and not its value, so a question about a name, `del`, the keys of
// `globals()` or what a failed module keeps, runs no computation. `undefined`
// when it holds nothing.
const heldAtSource = (namespace, name) => {
    if (Object.hasOwn(namespace, name)) return namespace[name];

    const proto = Object.getPrototypeOf(namespace);
    const accessor = proto === null ? undefined : Object.getOwnPropertyDescriptor(proto, name);

    if (accessor === undefined) return undefined;

    const source = STORED.get(proto)?.get(name) ?? accessor.get;

    return source === undefined ? accessor.value : source.call(namespace);
};

const holdsName = (namespace, name) => heldAtSource(namespace, name) !== undefined;

// When each name of a namespace was bound, which is the order `globals()` lists
// them in, as a dict lists its keys: the accessors sit on the prototype in the
// order the compiler declared them, all values and then all functions. A name
// bound again keeps its place; a name deleted and bound again goes last. A
// name no write stamped, `__name__` among them, was there before the body.
const BOUND_AT = new WeakMap();
let bindings = 0;

const stampBound = (namespace, name) => {
    let stamps = BOUND_AT.get(namespace);

    if (stamps === undefined) BOUND_AT.set(namespace, (stamps = new Map()));
    if (!stamps.has(name)) stamps.set(name, ++bindings);
};

const unstampBound = (namespace, name) => BOUND_AT.get(namespace)?.delete(name);

const inBindingOrder = (namespace, names) => {
    const stamps = BOUND_AT.get(namespace);

    return stamps === undefined ? names : names.sort((one, other) => (stamps.get(one) ?? 0) - (stamps.get(other) ?? 0));
};

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

// What Svelte makes of a value Python writes into a `bindable` prop the parent
// did not bind: it keeps its own copy, and wraps an array or a plain object in
// a state proxy, which a Brython list is. A proxy around a Brython object fails
// its type checks, `descriptor '__repr__' requires a 'list' object but received
// a 'list'`. So the write remembers what it wrote under what Svelte hands back,
// and the read gives Python its own object again. A bound parent's setter
// stores the value itself, and then the two are the same.
const WRITTEN = new WeakMap();

export const kept = (seen, written) => {
    if (seen !== written && seen !== null && typeof seen === 'object') WRITTEN.set(seen, written);
    return written;
};

export const unproxied = (value, crossed) => {
    if (crossed != null && Object.is(value, crossed.js)) return crossed.py;

    return (value !== null && typeof value === 'object' && WRITTEN.get(value)) || value;
};

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
// string or an int is its own JavaScript form and crosses as itself.
let handed = null;

export const handOver = (written, write) => {
    const crossing = viewOf(plainScalar(written));

    if (crossing === written) {
        write(written);

        return null;
    }

    const record = { js: crossing, py: written };
    const previous = handed;

    handed = record;

    try {
        write(crossing);
    } finally {
        handed = previous;
    }

    return record;
};

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
// Each of those dicts, to the namespace it is a view of.
const NAMESPACE_DICTS = new WeakMap();

// The entries a watch walks, which hands the watch to what a mapping holds: a
// namespace's names as held at their source, a derived's definition and not
// its value, which watching has no reason to compute; any other dict's own.
// A module a watched value reaches, a list of modules or one imported into a
// reactive module, was walked through its values, and every derived of it was
// run, read or not.
const heldEntries = (value) => {
    const namespace = NAMESPACE_DICTS.get(value);

    return namespace === undefined ? pyEntries(value) : Object.keys(value).map((key) => [key, heldAtSource(namespace, key)]);
};

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
                throw $B.$call($B.builtins.TypeError, "svelthon — a module's globals() takes names, which are strings");
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
})(globalThis.__BRYTHON__);

