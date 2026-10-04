// What every compiled component imports. `globals.js` prepares the scope
// brython.js reads as it loads, and `boot.js` imports the engine itself and
// starts it.
import './globals.js';
import './boot.js';
import { createSubscriber } from 'svelte/reactivity';
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
// It was called `py` while a template's expressions were still JavaScript and an
// author wrote `py.str(items)` in the markup, short on purpose, because it was
// typed by hand. Nothing types it now but generated code, so the short name was
// pure cost: it occupied `py` in every component's scope, and had to be kept out
// of reach through JS_RESERVED for that reason alone.
// An exception the author's own Python raised, as opposed to a conversion that
// could not be made.
//
// `truthy` and `str` try Python first and fall back to JavaScript, and the
// fallback is there for a foreign value — a DOM node, a JavaScript object —
// which Brython's own classifier trips on. It was catching both: a `__bool__`
// that raised decided the object was true, and a `__str__` that raised rendered
// `[object Object]`. The author's error disappeared and left a plausible page.
//
// Told apart by the *error*, not by the value, which keeps the value itself
// untouched — it may be a proxy that records every key read. A Brython exception
// is a plain object carrying `ob_type` and a `__traceback__`; it is not an
// `instanceof Error`, and it has no `__class__` either, which the first spelling
// of this assumed and the probe corrected.
const raised = (error) =>
    error !== null &&
    typeof error === 'object' &&
    pyClass(error.ob_type) &&
    error.__traceback__ !== undefined;

// An array-shaped Python value, as *its class* says it iterates.
//
// A Brython list is a JavaScript array, so anywhere this file walks elements it
// can walk the storage with no conversion at all, and for a list or a tuple that
// is exactly right. It stops being right the moment a subclass redefines
// `__iter__`: `[x for x in rows]` answered `[3, 2, 1]` in Python while the loop
// beside it showed `123`, for the same object, and the crossing and `tojson`
// answered `[1, 2, 3]` for it too. The storage is not the sequence when the
// author has said otherwise, and this is the one place that knows it.
//
// `list()` is not the road: Brython's constructor copies the storage of anything
// array-shaped, so asking it answers the question with the question.
// `make_js_iterator` is, and it carries both of the other obligations. It runs
// `iter()`, the only call that *validates* the protocol — an `__iter__` that
// returns a plain list is a TypeError in the script, and the template used to
// swallow it and render the list anyway. And it keeps the storage fast path
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
    // Asked of the *class*, which is the same repair the two converters took:
    // `ob_type` is a field name, and a JavaScript array is as free to carry one
    // as an object is. Read as a class, a business string was handed to Brython,
    // which tried to write a slot on it — *Cannot create property 'tp_iter' on
    // string 'business'*, a JavaScript accident where the author wrote
    // `{#each rows}`. One cause, and it surfaced at six crossings: the loop,
    // `batch`, the export, `tojson`, the argument boundary and `plainData`.
    if (!pyClass(value.ob_type) || value.ob_type === _b_.list || value.ob_type === _b_.tuple) {
        return value;
    }

    const $B = globalThis.__BRYTHON__;

    return $B.$list(Array.from($B.make_js_iterator(value, $B.NULL)));
}

// The values a key compares by value: rebuilt on every computation, so `(1, 2)`
// is another object each time and only its repr() stays the same.
const BY_VALUE = [_b_.tuple, _b_.frozenset, _b_.float, _b_.complex, _b_.bytes];

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
// integral one exact, a BigInt past 2 ** 53, and any other the double it is.
// Null for a value that is not one, and for a NaN, which equals nothing.
function numeric(value) {
    if (typeof value === 'boolean') return Number(value);
    if (typeof value === 'bigint') return value;
    if (typeof value === 'number') {
        if (Number.isNaN(value)) return null;
        return Number.isInteger(value) && !Number.isSafeInteger(value) ? BigInt(value) : value + 0;
    }

    const scalar = pyScalar(value);
    if (typeof scalar === 'number' || typeof scalar === 'bigint') return numeric(scalar);

    // A complex with no imaginary part is its real one.
    const mro = value?.ob_type?.tp_mro;
    if (Array.isArray(mro) && mro.includes(_b_.complex) && value.imag?.value === 0) return numeric(value.real.value);

    return null;
}

const boundText = (self, operation) => {
    const object = self !== null && (typeof self === 'object' || typeof self === 'function');
    return `method(${object ? identityOf(self, 'self') : keyText(self)}, ${operation})`;
};

function keyText(value) {
    if (value === null || value === undefined || value === NONE) return 'None';

    const number = numeric(value);
    if (number !== null) return String(number);

    if (typeof value === 'string') return _b_.repr(value);
    // A function is equal to itself alone, as an instance is: two built by one
    // factory print alike and are two keys.
    // A bound method is read anew each time, and two are equal when they bind
    // the same object to the same function: a method of the author's class,
    // `{ob_type: method, im_self, im_func}`, or a builtin's, a function carrying
    // `m_self` and `ml`.
    if (boundMethod(value)) return boundText(value.im_self, identityOf(value.im_func, 'function'));
    if (typeof value === 'function' && value.m_self !== undefined && value.ml?.ml_name !== undefined) {
        return boundText(value.m_self, value.ml.ml_name);
    }
    if (typeof value === 'function') return identityOf(value, 'function');
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

export const __pybridge = {
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

        // The names the list yields, which for a subclass with its own
        // `__iter__` are not the ones it stores: the loop beside it reads the
        // same ones.
        if (Array.isArray(value)) {
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
        // Equal to a number, it is that number, which is what an `int` key
        // already is: `1`, `1.0`, `True` and `Score(1.0)` are one key, as they
        // are one key of a dict. Equal to a string, it is that string.
        const number = numeric(value);
        if (number !== null) return number;

        // A bound method is rebuilt on every read, and equal by what it binds.
        if (boundMethod(value) || (typeof value === 'function' && value.m_self !== undefined && value.ml?.ml_name !== undefined)) {
            return keyFor(keyText(value));
        }

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
                // and the attempt has already walked part of it. That difference
                // was missing, so a JavaScript generator that threw on its
                // second step was read as *not Python's to convert*: `seq`
                // handed the spent generator back, `{#each}` rendered nothing,
                // `batch` answered `[]`, and the author's message was gone.
                //
                // No Python object carries `Symbol.iterator` — only a list, and
                // a list took the branch above — so a Python generator that
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
        // The rows the loop is given, and not where they came from. Two readings
        // in a row found this rule attached to a *representation* instead: it
        // walked the storage of a list subclass, which is not what a redefined
        // `__iter__` yields, and then it was written inside the array branch, so
        // a plain class with an `__iter__` — a collection by composition, which
        // is the ordinary way to write one — rendered its child and never
        // watched it. Once the rows exist the question is the same for every
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
            : value;
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
    // JavaScript reader can call it; a scalar is made JavaScript's; a container
    // is the object it is.
    toContext(value) {
        return value !== null && (typeof value === 'object' || typeof value === 'function') && callable(value)
            ? pyHandler(value)
            : plainScalar(value);
    },

    // And read by Python: what Python published is its own callable again, so a
    // Python reader holds what a Python writer held; a JavaScript function is
    // the adapter an import of it gets (`jsCall`), which converts what Python
    // hands it and what it answers; anything else is read as `pyBind` reads it.
    fromContext(value) {
        if (typeof value !== 'function') return pyBind(value);

        return PUBLISHED.get(value) ?? (declared(value) === null ? jsCall(value) : value);
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
    spreadElement(value, event = (one) => pyEvent(one)) {
        const out = spreadOf(value, __pybridge.bound);
        if (out === null || typeof out !== 'object') return out;

        for (const key of Object.keys(out)) {
            const wrapper = attributeWrapper(key);
            if (key[0] + key[1] === 'on') out[key] = event(value[key]);
            else if (wrapper === '__class') out[key] = __pybridge.klass(value[key]);
            else if (wrapper === '__truthy') out[key] = __pybridge.truthy(value[key]);
            else if (wrapper === '__hidden') out[key] = __pybridge.hidden(value[key]);
        }

        return out;
    }
};

// A spread's copy, each value converted: a fresh object, as a JavaScript spread
// of a `$state` proxy is, so Svelte's diff sees a dict mutated in place.
function spreadOf(value, convert) {
    if (value === null || value === undefined || typeof value !== 'object') return value;

    const out = { ...value };

    for (const key of Object.keys(out)) out[key] = convert(out[key]);

    return out;
}

// Methods that change a container.
//
// `__setitem__` and `__delitem__` are here, and the line that kept them out was
// right about the wrong thing: Brython does compile `d[k] = v` and `del d[k]` to
// their own calls, caught below, and that is a statement about the *statement*.
// An author calling the method by name is ordinary Python and is what a generic
// helper writes — `rows.__setitem__(0, 1)`, the same method kept as a value, or
// reached through the type. Those three reach the container and nothing else.
// The in-place operators and `__init__` are the same case: `rows += [1]` goes
// through `augm_assign`, and `rows.__iadd__([1])` or `list.__init__(rows, [2])`
// through nothing else.
//
// And an attribute written or deleted by name, `object.__setattr__(box, "value",
// 1)`: the same write `box.value = 1` makes, reached through the type.
const MUTATORS = new Set([
    '__setitem__', '__delitem__', '__init__', '__setattr__', '__delattr__',
    '__iadd__', '__imul__', '__ior__', '__iand__', '__isub__', '__ixor__',
    'append', 'extend', 'insert', 'remove', 'pop', 'clear', 'sort', 'reverse',
    'add', 'discard', 'update', 'setdefault', 'popitem', 'appendleft',
    'extendleft', 'popleft', 'rotate', 'intersection_update',
    'difference_update', 'symmetric_difference_update'
]);

// Methods that hand out a container the caller can then mutate, without any
// indexing to catch it.
const VIEWS = new Set(['items', 'values']);

// Every name a call on a watched container has to be followed up on. Read on
// the way out of `$getattr`, which is asked for every attribute in the program
// and has to decide in one lookup whether this one is any of its business.
const FOLLOWED = new Set([...MUTATORS, ...VIEWS, 'get']);

// Make an in-place mutation reactive: `items.append(x)` with nothing after it.
//
// Svelte's own answer is to proxy the value in depth, which is unusable here: a
// Python object behind a JavaScript proxy fails Brython's own type checks
// (`repr((1, 2))` raises "requires a 'tuple' object but received a 'tuple'").
//
// A Python list *is* a JavaScript array, so the object itself can carry a
// non-enumerable marker instead, since `$B.get_class` reads only `ob_type`, so
// `type(items) is list` stays true, `repr` is untouched, and nothing that walks
// the value can see the marker.
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
// nobody watches pays one property miss and nothing else.
//
// The marker travels with the object: a list handed to a helper that mutates it
// deep inside a function still notifies, which no static analysis could do.
function installMutationTracking($B) {
    if ($B.$svelthonTracking) return;
    $B.$svelthonTracking = true;

    const notify = (obj) => {
        if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) MARKS.get(obj)();
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
        if (obj === null || typeof obj !== 'object' || !MARKS.has(obj)) return;

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
                rewalk(obj, args[1]);
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
            MARKS.get(obj)();
        } else if (VIEWS.has(attr)) {
            // `.items()` and `.values()` hand out the children without ever
            // indexing them, so the watch is handed over here rather than on a
            // read that never happens.
            //
            // Asked of Python: a dict keeps its string keys as ordinary
            // properties and everything else in a hash table, so walking the
            // properties handed the watch to the children of `{"one": []}` and
            // not to those of `{1: []}`.
            for (const [key, child] of pyEntries(obj)) {
                inherit(obj, key);
                inherit(obj, child, key);
            }
        } else {
            inherit(obj, result); // `get`
        }
    };

    // A call whose target is its first argument rather than its receiver, which
    // is what reading a method off a type gives: `list.append(xs, 2)`.
    //
    // `call_attr` takes a position marker before the arguments, so the object is
    // `rest[1]` and what it was handed is everything after it — the same offset
    // the bound path uses when it passes `rest.slice(1)`.
    // The same rule as `onFirst`, for an operation kept as a value rather than
    // called through `call_attr`: the target is the first argument, the rest are
    // the arguments, and the question of whether anybody watches it belongs to
    // the call.
    const onType = (attr, method, descriptor) => {
        const wrapper = function (...args) {
            let result;

            try {
                result = method(...args);
                return result;
            } finally {
                afterCall(args[0], attr, result, args.slice(1));
            }
        };

        // Python has to keep seeing what it asked for, the same reason
        // `notifying` assigns over its method: a bare function answered
        // `JavascriptFunction` to `type(list.append)` and `AttributeError` to
        // `list.append.__objclass__`, where `list.copy` beside it answered
        // `method_descriptor` and `list`. Four properties carry that —
        // `ob_type`, `method`, `d_name`, `d_type` — and copying them restores
        // both answers, measured.
        return descriptor === undefined ? wrapper : Object.assign(wrapper, descriptor);
    };

    const onFirst = (obj, attr, rest, call) => {
        const target = rest[1];
        let result;

        try {
            result = call(obj, attr, ...rest);
            return result;
        } finally {
            if (target !== null && typeof target === 'object' && MARKS.has(target)) {
                afterCall(target, attr, result, rest.slice(2));
            }
        }
    };

    // Rest arguments rather than `arguments` + apply: these sit on the hottest
    // path Brython has, and the old form blocks V8's optimiser.
    const callAttr = $B.call_attr;
    $B.call_attr = function (obj, attr, ...rest) {
        // The marker is checked first on purpose: this runs on every method
        // call in the program, and an unwatched object must pay one property
        // miss, not a set lookup.
        let followed = obj !== null && typeof obj === 'object' && MARKS.has(obj) && FOLLOWED.has(attr);
        let target = obj;

        // `super().append(value)`: the method is looked up on a `super`
        // object, and the container it changes is that object's `__self__`.
        if (!followed && obj !== null && typeof obj === 'object' && obj.ob_type === _b_.super && FOLLOWED.has(attr)) {
            target = obj.obj;
            followed = target !== null && typeof target === 'object' && MARKS.has(target);
        }

        // `list.append(xs, 2)`, the same mutation as `xs.append(2)` written
        // through the type. The receiver is a class, which carries no marker, so
        // the object being changed is the first argument — known only here.
        //
        // The class test is a property miss before the set lookup, which keeps
        // an ordinary unwatched call paying what it paid before.
        //
        // `pyClass`, and not the single property this line used to read: the
        // other half of this same interception asks the predicate — `$getattr`
        // does, for the same question about the same objects — and one of the
        // two would have drifted. A JavaScript object carrying a `tp_bases` of
        // its own passed here and would have had its first argument taken for
        // the target of a mutation.
        if (!followed) {
            if (pyClass(obj) && FOLLOWED.has(attr)) {
                return onFirst(obj, attr, rest, callAttr);
            }

            return callAttr(obj, attr, ...rest);
        }

        // `finally`, because a mutator that raises has often mutated already:
        // `xs.extend(values())` consumes what the generator yielded before it
        // raised, so the list holds `[1]` and the author, who caught the
        // exception, saw the old value on the page for ever. The assumption that
        // an operation which raises has not changed the object does not hold in
        // Python, and the notification is the cheap side of that bet.
        //
        // `result` stays undefined on that path, which is what a raising call
        // returned anyway; `afterCall` reads it only to hand a returned
        // container the watch.
        let result;

        try {
            // `call_attr` takes the position marker before the arguments, and
            // it is the arguments that come under watch.
            result = callAttr(obj, attr, ...rest);
            return result;
        } finally {
            afterCall(target, attr, result, rest.slice(1));
        }
    };

    // `add = xs.append` and then `add(1)`, one statement later or one component
    // away. The method has left the object as a value, so the interception
    // above never sees the call: Brython compiles the attribute read to
    // `$getattr` (`$getattr_pep657` delegates to it, and so does the builtin
    // `getattr`) and the later call to `$B.$call`, which is a plain JavaScript
    // call on whatever it was handed. Wrapping the method as it leaves is what
    // puts `afterCall` back on that path, and it is the last place where the
    // object the method belongs to is still known.
    const notifying = (obj, attr, method) => {
        const wrapper = function (...args) {
            // The same `finally` as the interception above, for the same
            // reason: a detached mutator that raises may have mutated first.
            let result;

            try {
                result = method(...args);
                return result;
            } finally {
                afterCall(obj, attr, result, args);
            }
        };

        // Python has to keep seeing the method it asked for: `type(add)` and
        // `repr(add)` read `ob_type`, `ml` and `m_self` off the function
        // object, and a bare wrapper would answer `function` where Brython
        // answers `builtin_method`. Brython sets those five as plain
        // properties, so an assign takes them and leaves `length` and `name`,
        // which a function carries as its own and non-enumerable.
        return Object.assign(wrapper, method);
    };

    const getattr = $B.$getattr;
    $B.$getattr = function (obj, attr, ...rest) {
        const result = getattr(obj, attr, ...rest);

        if (obj === null || typeof obj !== 'object') return result;

        // Wrapped whether or not the object is watched **yet**. The decision
        // used to be taken here, at the read, and never revisited: a factory
        // that hands out its state and an operation on it — `values, add =
        // make()` — gives the operation away before the state has a name, so the
        // list became reactive afterwards and `add(1)` told nobody, for ever.
        // `afterCall` asks at the call instead, which is the moment that knows.
        if (FOLLOWED.has(attr)) {
            // The container a method changes: the object itself, or the
            // `__self__` of a `super` it was read through.
            const owner = obj.ob_type === _b_.super ? obj.obj : obj;

            // Four shapes reach here and only the first is a function. A
            // special method read off a builtin is a `method-wrapper`
            // (`rows.__setitem__`), one read off a type is a
            // `method_descriptor` (`list.append`) or, for a slot, a
            // `wrapper_descriptor` (`object.__setattr__`); all are objects, and
            // all are called through Python's own protocol.
            const call =
                typeof result === 'function'
                    ? result
                    : result !== null &&
                        typeof result === 'object' &&
                        (result.ob_type === $B.method_wrapper ||
                            result.ob_type === $B.method_descriptor ||
                            result.ob_type === $B.wrapper_descriptor)
                      ? (...args) => $B.$call(result, ...args)
                      : null;

            // A method taken off the **type** carries no target: `add =
            // list.append` finds its list in the first argument, at the call.
            // `call_attr` already knows that rule and `onFirst` applies it; a
            // method kept as a value left that path, so `add(rows, 1)` mutated a
            // watched list and told nobody, while `list.append(rows, 1)` written
            // in place worked.
            if (call !== null && pyClass(obj)) {
                return onType(attr, call, typeof result === 'function' ? undefined : result);
            }

            if (typeof result === 'function') return notifying(owner, attr, result);

            // A method-wrapper stays one, `type()`, `__self__` and `repr()`
            // included, and so does what the export boundary sees of it: only
            // the function it calls is wrapped, and Brython's own call,
            // `wrapped(self, ...args)`, is what reaches it.
            if (call !== null) {
                const wrapped = (target, ...args) => {
                    let out;

                    try {
                        out = result.wrapped(target, ...args);
                        return out;
                    } finally {
                        afterCall(owner, attr, out, args);
                    }
                };

                // The operation it stands for, shared by every receiver: what
                // an adapter is keyed by, so two reads are one callback.
                wrapped.original = result.wrapped;

                return { ...result, wrapped };
            }
        }

        if (!MARKS.has(obj)) return result;

        // What an attribute read hands back, the way `$getitem` treats a
        // subscript: reading is the last moment before the value could be
        // mutated, and it is the only moment for a value the initial walk cannot
        // see. `class Box: rows = []` lives on the class, deliberately shared,
        // and reaching it through a watched instance is an ordinary read.
        //
        // The read that already happened, and nothing more: no walk of the class
        // hierarchy, so no property of the author's is run by the act of
        // watching, and `inherit` steps over a function, a string or a class on
        // its own.
        inherit(obj, result, undefined, true);

        return result;
    };

    const setitem = $B.$setitem;
    $B.$setitem = function (obj, key, value, ...rest) {
        // In a `finally`, like every other mutation path. A `__setitem__` of the
        // author's may store what it was given and *then* refuse it, and the
        // exception does not take the entry back out — the same sentence that
        // was learned at `extend`, at `|=`, and at `__setattr__`.
        //
        // No bench tells this line from the one it replaces, and the reason is
        // worth writing down: anything an author can write inside their own
        // `__setitem__` goes through one of the other interceptions, and that
        // one notifies, so the page is repainted by the inner write. The shape
        // is made uniform anyway, because these defects are reintroduced by
        // copying the site next door, and `tests/mutation-notifies-in-finally`
        // is what reads the shape.
        try {
            return setitem(obj, key, value, ...rest);
        } finally {
            if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) {
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
        if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) {
            inherit(obj, result);
        }
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
    // The first repair looked up the attribute that was written, which covers a
    // `__setattr__` that normalises its value — `object.__setattr__(self, name,
    // list(value))` — and not one that stores it under a name of its own:
    // `self._rows` for a written `rows` is the ordinary private-field spelling,
    // and the list the object holds got no link while the one that came in did.
    // Asking for one name could never answer that, so the object is asked what
    // it holds now.
    //
    // Three steps, and each answers something the others cannot. `adopt` links
    // the storage in one hop and scans the slots, which is the same walk `mark`
    // does. That link alone is not enough: a storage dictionary walks its own
    // entries when it is *first* marked, so a second write into it reaches
    // nobody — hence the walk of the storage itself. And the value that came in
    // stays linked, because an object may keep it somewhere neither of the two
    // can see, which is what the fallback has always been.
    //
    // All of it is idempotent: `inherit` keeps one parent per child and `mark`
    // is a WeakMap lookup away. It runs only for an object under watch, which is
    // the guard the caller already holds.
    const rewalk = (obj, value) => {
        adopt(obj);

        const attributes = ownAttributes(obj);

        if (attributes !== null && typeof attributes === 'object' && MARKS.has(attributes)) {
            adopt(attributes);
        }

        inherit(obj, value, undefined, true);
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
                if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) {
                    // What the write *stored*, and not only what it was handed.
                    // A `__setattr__` of the author's may normalise, copy or
                    // wrap its argument — `object.__setattr__(self, name,
                    // list(value))` is an ordinary way to defend an invariant —
                    // and the watch then went to the list that was passed in
                    // while the one the object holds got none. Mutating it
                    // through an alias the program already had notified nobody,
                    // and the page kept the old row count.
                    //
                    // Read off the instance's own storage, never through
                    // `$getattr`: a property of the author's must not run
                    // because something was written.
                    rewalk(obj, value);
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
    // Brython builds the two methods once, from `tp_descr_set` as it was then
    // (`make_set_del`), so they are rebuilt here the same way around a setter
    // that notifies. `tp_descr_set` itself is left alone: an ordinary
    // `box.rows = [1]` reaches it from `$setattr`, which already answers.
    const member = $B.member_descriptor;
    const describe = member.tp_descr_set;
    const described = (self, obj, value) => {
        try {
            return describe(self, obj, value);
        } finally {
            if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) {
                if (value !== $B.NULL) rewalk(obj, value);
                MARKS.get(obj)();
            }
        }
    };

    $B.set_to_dict(member, '__set__', $B.wrapper_descriptor.$factory(member, '__set__', described));
    $B.set_to_dict(
        member,
        '__delete__',
        $B.wrapper_descriptor.$factory(member, '__delete__', (self, obj) => described(self, obj, $B.NULL))
    );

    const delattr = $B.$delattr;
    $B.$delattr = function (obj, ...rest) {
        // In a `finally`, like the write beside it: a `__delattr__` of the
        // author's may remove the attribute and *then* raise, and the exception
        // does not put it back. The page showed `True` for a `hasattr` the model
        // answered `False` to.
        try {
            return delattr(obj, ...rest);
        } finally {
            notify(obj);
        }
    };

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
        const watched = left !== null && typeof left === 'object' && MARKS.has(left);
        let result;

        // An exception is not proof that nothing changed. `d |= values()` keeps
        // the entries the generator yielded before it raised, and the operator
        // never returns: the identity test below never runs, the assignment that
        // would have rebound the name never happens, and nothing downstream
        // makes up for the missing notification. The method paths already take
        // this shape, which is why `d.update(values())` was right and `d |=
        // values()` beside it was not.
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

// Only a container can be mutated in place; a scalar propagates by rebinding,
// which the accessor already handles.
function mutable(value) {
    if (value === null || value === undefined || typeof value !== 'object') return false;
    if (Array.isArray(value)) return true; // list, and a tuple is one too
    if (value === NONE) return false; // a singleton shared by the whole program

    try {
        const cls = globalThis.__BRYTHON__.get_class(value);
        // A class object is not data, and a function is not an object here.
        return cls !== undefined && cls !== _b_.type;
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
// Python. That decision was right and it lived at one site, `pyExport`, so every
// other path that meets a class quietly decided the opposite — a class exported
// directly survived and the same class inside a dict or a list came out as
// `{__qualname__, __doc__, __module__}`, which is not callable. A `load()`
// returning a registry of models is the ordinary way to write a route.
//
// So the decision lives in a predicate now, and the two sites ask it.
export const pyClass = (value) =>
    value !== null &&
    typeof value === 'object' &&
    value.ob_type !== undefined &&
    value.tp_name !== undefined &&
    value.tp_bases !== undefined;

// The class of a Python object, or undefined for anything else. Brython keeps
// it in two places: `ob_type` on most objects, and `Symbol(OB_TYPE)` on a dict
// and every subclass of one, which has no `ob_type` at all. A site that looks a
// protocol up on the class asks here, so `class Bag(dict)` defining `__call__`
// is callable like any other class that defines it.
const pyType = (value) => {
    if (value === null || typeof value !== 'object') return undefined;

    const type = value.ob_type ?? value[globalThis.__BRYTHON__.OB_TYPE];

    return pyClass(type) ? type : undefined;
};

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

// `pyType`, asked that way: an `ob_type` getter of a JavaScript object is the
// author's code, and a data field of that name is read once, by the serialiser.
const quietPyType = (value) => {
    if (value === null || typeof value !== 'object') return undefined;

    const type = quietly(value, 'ob_type') ?? quietly(value, globalThis.__BRYTHON__.OB_TYPE);

    return pyClass(type) ? type : undefined;
};

// Whether an object is a bag of keys, or something of a class of its own: a
// Response, a URL, a Date, a Map, a Promise, any of which a `load()` may hand
// straight back and whose keys copied would destroy it.
//
// Read on the prototype and not as `value.constructor`, which a dict may carry
// as data: `{"constructor": "invoice"}` answered a constructor of its own and
// the whole mapping crossed unconverted, floats and all. A Brython dict and a
// plain object both sit on `Object.prototype`, and a **null** prototype is the
// other bag of keys — `Object.create(null)`, what `Object.groupBy` returns, and
// a module namespace object, measured.
//
// A predicate and not two lines, because it was two lines: `branch` walked a
// null-prototype object and `mapping()` in helpers.js did not, so `to_js` and
// `tojson` rendered `{"a":1,"b":2}` while `urlencode` wrote
// `<Javascript object: [object Object]>` into the page, percent-encoded, with no
// error and no warning. Two of the three crossings already agreed; this is the
// third asking the same question instead of its own.
// And a **root** prototype rather than *our* `Object.prototype`, which is the
// realm mistake of `URL`, `Date` and `Promise` at a fourth family of sites. An
// object built by another JavaScript context sits on that context's
// `Object.prototype`, is a bag of keys by every use, and failed this test: it
// crossed as a `JSObject` where the local twin became a dict, so `.get()` raised
// in Python; it kept a Brython dict raw inside an exported object; and
// `urlencode` wrote the engine's spelling of it into the query string.
//
// *Root* is what every realm's `Object.prototype` has in common: a `Date` sits
// on `Date.prototype`, which sits on `Object.prototype` in turn, so it is two
// steps from null and stays excluded — here and in every other realm.
//
// Rootless is not enough, and the line above said it was. `class Thing extends
// null {}` is valid JavaScript and its prototype is rootless too, so an instance
// carrying a method was flattened into its fields and the method was gone. What
// separates the two is that a realm's `Object.prototype` **is** the object
// protocol: `hasOwnProperty` is its own property, where a class prototype's own
// properties are the author's plus `constructor`. Called generically, because
// the function has to work on a prototype from any realm — including one whose
// own `hasOwnProperty` is exactly what is being looked for.
// A native object `JSON.stringify` has nothing to write of: a class of its own,
// no `toJSON` to ask, and no enumerable own property to copy. Its answer is
// `{}` — valid JSON that silently drops everything the value held, so
// `tojson(new Map([["answer", 42]]))` said `{}` and `{"map":{}}` one level down.
//
// Asked as a behaviour and not as a list of names, which is the shape this
// project keeps getting wrong: the question is *what will the serialiser do with
// it*, and the answer covers a Map, a Set, a Headers, a Response and whatever
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
// **Asked of Brython, not discovered.** This scanned an object's own symbols for
// one described `DICT`, kept it, and skipped arrays so a plain list would not
// pay for the scan. A list subclass is an array *and* carries that dictionary,
// so it could never teach the symbol to the runtime: if it was the first such
// object watched, nothing was ever learned and its attributes were never walked
// — and the same component repainted or not according to **mount order**,
// depending on whether an ordinary instance had been watched before it.
//
// `$B.DICT` is published by `py_type.js`, so there was nothing to discover. Two
// defects, an order dependence and a blind spot, and the repair is one lookup.
function ownAttributes(value) {
    const dict = globalThis.__BRYTHON__.DICT;

    return dict === undefined ? undefined : value[dict];
}

// A watch runs from the object that was named to every container under it, and
// a mutation anywhere under a name has to reach whoever is reading that name.
//
// The link points *up*: a child holds its parents, and notifying walks from the
// mutated object towards the names. Holding it the other way, which is to say
// copying the parent's subscribers down into each child, is what left two
// defects with one cause. A subscriber cannot sign off, because its callback is
// in every copy and nothing knows where they are; and a subscriber arriving
// after a child was handed the watch lands in the parent's list alone, so
// mutating that child never reaches it. Measured, both.
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
const upwards = (marker, stamp, key) => {
    if (marker.seen === stamp) return;
    marker.seen = stamp;

    for (const one of marker[key]) one();

    const parents = marker.parents;
    if (parents === undefined) return;

    const child = marker.target.deref();

    // A link found to hold stays found until its parent changes: a dict of rows
    // whose rows are each updated would otherwise read every entry of the dict
    // once per row.
    const verified = (marker.verified ??= new WeakMap());

    for (let i = parents.length - 1; i >= 0; i--) {
        const parent = parents[i];
        const holder = parent.target.deref();
        const known = verified.get(parent) === parent.stamp;

        if (holder === undefined || (child !== undefined && !known && !holds(holder, child, marker))) {
            parents.splice(i, 1);
            continue;
        }

        verified.set(parent, parent.stamp);

        upwards(parent, stamp, key);

        // A parent nobody listens to and that leads nowhere is a dead end: the
        // container of a component that is gone. Its link goes, or every
        // mutation of shared data would visit one per mount the session has
        // seen. `track` links a container's children again if it is ever
        // subscribed to anew.
        if (dead(parent)) parents.splice(i, 1);
    }
};

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

    if (base === undefined || stores(base, holder, child, marker)) return true;

    return base !== cls && (marker.loose?.has(holder) === true || redefinesItems(cls));
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

        for (const [one, value] of pyEntries(holder)) if (one === child || value === child) return true;
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
// on its link so that `holds` reads one slot. A child linked without it was
// searched for at its next mutation, and a table loaded with `extend` after the
// watch began paid a search of the whole list for every row it updated. So the
// rows an `append`, an `extend` or a `+=` add are indexed where they land, at
// the end, and a mutation that moves the others indexes the list again, at a
// cost no larger than its own.
function indexed(list, from) {
    if (!Array.isArray(list) || storedAs(list.ob_type) !== _b_.list) return;

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
// It used to be a non-enumerable `$notify` property on the container itself, and
// **a Brython dict exposes its keys as ordinary properties**, so a business key
// of that spelling met the mechanism: `{"$notify": "business data"}` made the
// component fail at mount, on data Python is entitled to hold and that an API
// may well send.
//
// Not a symbol either, and that is the interesting half: an own symbol key makes
// an object unusable as a WebIDL record, which is what `new Response(body,
// {headers})` takes. Brython hit the same wall with its own back-reference and
// moved it to a WeakMap; this is the same move for the same reason.
//
// A WeakMap also retires two guards the property needed: the `try` around a
// frozen object, which refused the marker, and the check that `Storage` had not
// turned the marker into its own source text on the way in. Neither can happen
// to a key held outside the object.
const MARKS = new WeakMap();

// The marker of a watched container, and the one export in this file that exists
// for a test. Counting the subscribers of a shared list is the measurement the
// leak tests are built on, and the marker is no longer a property anyone can
// reach; naming the door here is what keeps that measurement possible, and the
// rule the project already follows for an internal it depends on: when the code
// reads a name, a test names it too.
export const marks = (value) =>
    value !== null && typeof value === 'object' ? MARKS.get(value) : undefined;

// Brython's own name for a slot's storage on an instance, from `set_slots` in
// `py_type.js`. Part of the vendored contract, like `$store` and `$iter_items`.
const SLOT = 'slot_value_';

// A name declared by a class **or by one of its bases**, read from the class
// dictionaries rather than through the attribute protocol, so nothing of the
// author's runs while a value is merely being converted.
//
// `$B.search_in_dict` reads one dictionary and stops. Both readers below took it
// for a walk of the chain, and both comments said so in as many words, which is
// how it went unnoticed on two boundaries at once: an instance whose `__call__`
// is defined on a base class was not callable anywhere, and a subclass that
// inherits `__slots__` without redeclaring them crossed to JavaScript as `{}`,
// its fields gone and its JSON valid.
//
// The loop is Brython's own: `super.__getattribute__` asks `search_in_dict` once
// per class of the MRO. `tp_mro` begins at the class itself — `[cls, ...bases,
// object]` — and ends at `object`, which declares neither of the two names asked
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

// Whether this object's *class* declares `__slots__`, which is the question, and
// not whether the object happens to carry a property whose name begins like
// one.
//
// Read from the type, for two reasons that are the same reason. A plain
// JavaScript object `{slot_value_price: 42, currency: "EUR"}` is data, and
// asking its property names made the converter rename one key and drop the
// other — foreign data losing fields on the way through a Python return.
// And an instance whose slots are all still unassigned carries no storage at
// all, so asking the object said "not an instance" and the engine's own view
// went out instead, `{ob_type: …}`, circular through the class.
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
// Here they are `{ob_type, source}`, so the walk reached the class first and the
// refusal named `<class 'bytes'>` about a value — the same wrong accusation a
// `set` used to get, at the neighbouring type.
//
// Asked of the MRO rather than of the class by identity, so a subclass answers
// too: the lesson of `pyScalar` and `isSet`, which both learned it the hard way.
export const pyBytes = (value) => {
    const cls = value.ob_type;
    const mro = pyClass(cls) ? cls.tp_mro : undefined;

    if (!Array.isArray(mro)) return false;

    return mro.includes(_b_.bytes) || mro.includes(_b_.bytearray);
};

export const isSet = (value) => {
    const cls = globalThis.__BRYTHON__.get_class(value);

    if (cls === undefined || value.$store === undefined) return false;
    if (cls === _b_.set || cls === _b_.frozenset) return true;

    // A subclass is a set. `class Bag(set): pass` redefines nothing and is an
    // ordinary way to name a domain type, and an equality against the two
    // builtins said no: its members were never taken under watch, so mutating
    // one changed the data and left the page as it was.
    //
    // Read from the type's own ancestry rather than through `isinstance`, which
    // goes through `__instancecheck__` and would run a protocol of the author's
    // while the walk is in flight. The `$store` test above stays: a foreign
    // object carrying that name is not a set.
    return Array.isArray(cls.tp_mro) && (cls.tp_mro.includes(_b_.set) || cls.tp_mro.includes(_b_.frozenset));
};

function mark(value) {
    // `stamp` moves each time the container itself changes, which is what
    // `upwards` needs to know whether a link it checked is still to check.
    const marker = () => {
        marker.stamp = ++changes;
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
function adopt(value) {
    const attributes = ownAttributes(value);
    if (attributes !== undefined) {
        // The storage itself, and not only what it holds. Setting an attribute
        // usually goes through something this file intercepts — `$setattr` for
        // `box.value = 1`, and the `$getattr` that hands the watch to what it
        // returns for `box.__dict__[...]` — but `vars(box)` asks the engine for
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
    // as an own property of the object named `slot_value_<name>`
    // (`descriptors.js`, `d_member.attr`). So the walk above found nothing, and
    // `box.rows.append(1)` changed the list while the page kept the old count.
    //
    // Read off the object rather than asked of the class, which settles the
    // three neighbouring cases at once: an uninitialised slot has no property
    // and is skipped, an inherited slot is stored here like any other, and
    // nothing goes through `$getattr`, so no property getter of the author's is
    // run by the act of watching. An array is scanned only when its class
    // declares slots: a plain list's keys are its indices, and a long one would
    // pay for a scan that cannot match, but `class Rows(list)` with `__slots__`
    // keeps its slots on the array beside the elements.
    if (!Array.isArray(value) || declaresSlots(value)) {
        for (const key of Object.keys(value)) {
            if (key.startsWith(SLOT)) inherit(value, value[key], undefined, true);
        }
    }

    // Only what Python calls a container, and that bound is the whole point:
    // walking any object's keys let the watch leave the author's data. Measured,
    // it reached `__BRYTHON__` itself, 558 keys, and from there `localStorage`.
    //
    // The line that stood here said a set could hold nothing worth walking,
    // since a list is not hashable. **Hashable and immutable are two
    // properties**, and the sentence used one for the other: a user class is
    // hashable by default and its attributes are mutable, so `{Box()}` holds
    // exactly what this walk exists for. Measured in a mounted component —
    // `item.value += 1` changed the Python value and left the paragraph showing
    // the old one, where the same component holding `[Box()]` repainted.
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
        for (const [key, child] of pyEntries(value)) {
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
        // `keys()`, `values()`, `items()` and the read-only `mappingproxy` a view
        // hands out as `.mapping` are live: they hold no entry of their own,
        // only the dict they read. So the dict is the view's child, and what
        // changes the dict reaches what reads the view, as it reaches what
        // reads the dict.
        inherit(value, viewed(value));
    }
}

// The dict a live view reads, or undefined: the three views of a dict, which
// Python offers no way to subclass, keep it as `dict_obj`; a `mappingproxy`
// keeps it as `mapping`, and is followed only when that is a dict, the class
// dictionary behind a `type.__dict__` being no data of the author's.
const viewed = (value) => {
    const $B = globalThis.__BRYTHON__;
    const type = value.ob_type;

    if (type === $B.dict_keys || type === $B.dict_values || type === $B.dict_items) return value.dict_obj;
    if (type === $B.mappingproxy && $B.is_dict(value.mapping)) return value.mapping;

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

    if (previous !== value && previous !== null && typeof previous === 'object') {
        const old = MARKS.get(previous);
        if (old !== undefined) leave(old, bump, owner);
    }

    if (value === null || typeof value !== 'object') return value;

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
// Without this, a container shared through a store keeps the callbacks of every
// component that ever read it: measured at 2, 3, 4, 5 subscribers over four
// mount cycles of one child, for one child alive.
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
function inherit(parent, child, key, loose = false) {
    if (child === null || typeof child !== 'object') return child;

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
    const marker = MARKS.get(parent);

    if (own.parents === undefined) own.parents = [marker];
    else if (!own.parents.includes(marker)) {
        // The list grows here and only here, so it is swept here: a parent
        // whose container is gone leaves. `upwards` does the same when the
        // child changes, but a shared child may never change, and each mount
        // that wrapped it in a container of its own left one link behind.
        for (let i = own.parents.length - 1; i >= 0; i--) {
            if (own.parents[i].target.deref() === undefined) own.parents.splice(i, 1);
        }

        own.parents.push(marker);
    }

    // Keyed on the container, not on its marker: the child holds the marker
    // for as long as the link lasts, and through it the key, an object of the
    // author's that the dict itself had let go. The container already holds
    // its key, so this holds it no longer than the container lives.
    if (key !== undefined) (own.keys ??= new WeakMap()).set(parent, key);
    if (loose) (own.loose ??= new WeakSet()).add(parent);

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
    if (value !== null && typeof value === 'object') {
        const marker = MARKS.get(value);
        if (marker !== undefined) marker.follow();
    }

    return value;
}

// A Python line as a line of the file. `lineOffset` is a number, the count of
// lines before the `<script>` body, or that number with the ranges of Python
// lines the template's functions occupy, since those are generated after the
// body: a line in one of them is reported at the markup it stands for, and any
// other line is the author's own.
const inFile = (line, lineOffset) => {
    if (typeof lineOffset === 'number') return line + lineOffset;

    const range = lineOffset.ranges.find(([from, to]) => line >= from && line <= to);

    return range === undefined ? line + lineOffset.offset : range[2];
};

// A Brython exception reaching JavaScript carries no `message` and no `stack`,
// so devtools and Vite's overlay show nothing at all: the text sits in the
// Python object, where nothing JS looks. Fill both in, keeping the original
// object so Python semantics upstream are untouched.
export function pyError(error, where, lineOffset = 0) {
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
    // own numbering. A deeper frame in another file is where it actually broke,
    // and it is named with its own file and its own line, which `inFile` knows
    // nothing about.
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

    let at = own === undefined ? where : `${where}:${inFile(own.line, lineOffset)}`;
    if (deepest !== undefined && deepest.file !== home) {
        at += `; raised in ${deepest.name}(), ${deepest.file}:${deepest.line}`;
    }

    try {
        error.message = `${described} (${at})`;
        if (error.stack === undefined) error.stack = `${error.message}\n    at ${at}`;
    } catch {
        /* a frozen exception: pass it on as it stands */
    }

    return error;
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
// there its class and `__mro__`, which contains itself — so a runner cloning the
// error to send it from its worker to the main thread walks a cycle through a
// class object. Measured: `Aborted (core dumped)`, `OOMErrorHandler`, on a
// five-line component whose handler raises. Not a failing test naming the file —
// the worker dying, and `npm test` ending on a V8 abort.
//
// So the boundary hands over an ordinary `Error` and **keeps nothing of the
// Python object on it**. Keeping it under a non-enumerable property was tried
// first and the abort survived: the walk reaches an own property whether it is
// enumerable or not, so a reference kept for a debugger is a reference kept for
// the serialiser. Measured both ways, with and without.
//
// Same shape as `plainData` and `__mro__` in §3.20: the third time this project
// has met a Brython object walked by something that serialises.
// A call that has been made and not finished.
//
// Asked in four places and written out in all four, one of them in `helpers.js`,
// which is how a predicate starts drifting: the two files cannot share a
// spelling by accident, only on purpose. Compared in JavaScript rather than
// through `aio.iscoroutine()` — this runs on every call into Python, template
// expressions included, and a Brython call here costs more than the check saves.
export const pyCoroutine = (value) => {
    const $B = globalThis.__BRYTHON__;

    return value !== null && typeof value === 'object' && $B.get_class(value) === $B.coroutine;
};

// A Python scalar held as an object, and the number or the string inside it.
//
// A Brython float is an object holding a number, which is the reason `pyNumbers`
// exists at all: what a framework is handed must be a number, not an object that
// prints like one. Three converters asked that by hand, and all three asked it as
// an **identity** — `ob_type === float` — so a *subclass* answered no.
//
// `class Price(float)` is an ordinary business type, and it crossed as `{}`: the
// walk found no float, treated it as an instance, and published its attributes,
// of which it has none. The number was never lost in Python, where `format(p,
// ".2f")` kept working; it was lost in the JavaScript that was built from it.
// Measured the same day: `int` and `str` subclasses do it too.
//
// Read from the MRO, which begins at the class itself, so the exact type and the
// subclass take the same path — the third time this file asks a question that
// way, after `is_dict` and the two sets. Where the value sits is Brython's
// layout: `value` for a number, `$brython_value` for a string.
//
// What does **not** cross is anything else the subclass holds. `Price(0.25)`
// with a `currency` attribute crosses as `0.25`: a value that *is* a number
// crosses as its number, and its fields stay in Python, which is the same
// sentence as the one a callable gets.
export const pyScalar = (value) => {
    if (value === null || typeof value !== 'object' || !pyClass(value.ob_type)) return undefined;

    // **A limit, and it was measured rather than assumed.** `ob_type` is a
    // public key, so a JavaScript object can carry one: the repair at the
    // forty-second reading was for a field holding a business *string*, and a
    // field holding a real Brython class walks straight past it. So
    // `{ob_type: float, value: 42, label: "kept"}` crosses as the number `42`
    // and the `label` beside it is gone.
    //
    // It cannot be closed by looking, and two attempts proved it. The prototype
    // looked like the answer — a float from `1 / 4`, from a literal, from a sum
    // and from `$factory` all carry one of the engine's own, and an object
    // literal carries `Object.prototype` — and then fifty tests went red,
    // because a float that has crossed a boundary is a plain object too. Adding
    // *and it claims the builtin itself* left thirty-six. **A genuine Brython
    // float and `{ob_type: float, value: 42}` are the same object**, field for
    // field, on the paths that matter.
    //
    // What would close it is provenance — the engine marking what it made — and
    // that is Brython's to give, not ours to infer. Until then the contract is
    // the honest one: a value carrying a Brython class under `ob_type` **is**
    // that value here. `tests/helpers.test.js` pins it so nobody rediscovers it
    // as a surprise.

    const mro = value.ob_type.tp_mro;

    if (!Array.isArray(mro)) return value.ob_type === _b_.float ? value.value : undefined;
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
// a number, and a container as itself, since its identity is what a mutation
// is followed by. The read half of the store's setter, which takes `__pyArg`.
export const plainScalar = (value) => {
    const scalar = pyScalar(value);
    return scalar === undefined ? value : scalar;
};

function thrown(error) {
    if (error instanceof Error || error === null || typeof error !== 'object') return error;

    // `??` and not `||`, and a mutation sweep cannot tell: the difference is an
    // **empty** message, and the only caller runs `pyError` first, which
    // describes the exception and hands back an `Error` — so the line above
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

    return { then: (resolve, reject) => then.call(value, resolve, reject) };
};

// Calling an `async def` from JavaScript returns a coroutine that nobody runs:
// the handler appears to do nothing at all, silently. Brython has its own event
// loop, so hand it over. `convert`, when given, is applied to the value the
// coroutine returns, the conversion a synchronous result gets at the same site.
export function schedule(result, where, lineOffset = 0, convert = undefined) {
    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (!aio || result === undefined || result === null) return result;

    // Compared in JavaScript rather than through aio.iscoroutine(): this runs on
    // every call into Python, template expressions included, and a Brython call
    // here costs more than the check saves.
    if (!pyCoroutine(result)) return result;

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
    // other. What stays local is everything below — the promise that knows
    // whether anybody awaited it, and the rethrow for a failure nobody caught.
    const promise = new Waited((resolve, reject) => {
        (convert === undefined ? started(result) : started(result).then(convert)).then(
            resolve,
            (error) => {
                const failure = pyError(error, where, lineOffset);
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
// `__proto__` has on `Object.prototype`, so a dict holding that key lost it and
// handed back an object whose prototype was whatever the key held:
// `{"__proto__": {"flag": 42}}` crossed as `{}` answering 42 for `flag`. A key
// is data here, wherever it came from.
// Every pair of a mapping, which for a Python dict is not `Object.keys`.
//
// A Brython dict has two halves: string keys are ordinary JavaScript properties,
// which is what makes `d["a"]` as fast as a native read, and everything else
// lives in a hash table under symbols — a property name is always a string, and
// Python keeps `1` and `"1"` apart. Walking the properties reads the fast half
// and drops the rest without a word: a table indexed by id encoded to nothing in
// a URL, and an entry whose key is `__proto__` never reached an export, since
// that one cannot be an ordinary property either and lives in the table too.
//
// Asked of Python, which is the only half that knows both.
// `dict.$iter_items` rather than `items()`, and that is not an optimisation:
// the reactive tracking intercepts `call_attr`, and `items` is one of the calls
// it answers by handing the watch to the children — through this function. Going
// through Python's own method would call it again, for ever. Measured:
// `RangeError: Maximum call stack size exceeded`.
export function pyEntries(value) {
    const $B = globalThis.__BRYTHON__;

    if (!$B.is_dict(value)) return Object.entries(value);

    return [...$B.builtins.dict.$iter_items(value)].map((entry) => [entry.key, entry.value]);
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
    const result = hooked ? hook.call(value, key) : value;

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

    // A callable that `typeof` calls an object — a bound method, an instance
    // whose class defines `__call__` — and only when someone asked for
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


    // A promise, under the serialiser's rule only.
    //
    // The coroutine below was given this arm and the shape it *becomes* was not,
    // so `tojson` of a JavaScript promise answered `{}` — valid JSON that says
    // nothing about what was asked, and `{"task":{}}` one level down, where the
    // shape around it makes the empty object look like an answer. A promise
    // keeps its result where nothing enumerable can reach it.
    //
    // Here and not in the serialiser's replacer, because the replacer sees a
    // *bare* thenable only after the walk has already met the `then` inside it
    // and refused that as a callable: one shape, two sentences, decided by
    // whether the author's awaitable happened to be built by `Promise`. Asked
    // before the walk, both get the sentence about promises.
    //
    // Every other caller hands its result to JavaScript, where a promise is
    // exactly what is wanted, so the branch is the JSON rule's alone.
    // Three shapes with no JSON, asked before the walk and under the
    // serialiser's rule only. Every other caller hands its result to JavaScript,
    // where a promise is exactly what is wanted and a Map is a Map.
    //
    // A **Python set** is here because the walk reached its internals first: it
    // is a plain object holding `$store` and `ob_type`, so the refusal that came
    // out named the *class* — `<class 'set'> is a class, and a class has no
    // JSON` — about an instance. True of what the walk had in hand by then, and
    // false about what the author passed.
    if (
        adapt !== undefined &&
        seen instanceof Set &&
        (thenable(value) || isSet(value) || pyBytes(value) || opaque(value))
    ) {
        return adapt(value);
    }

    // A coroutine handed to the framework becomes a promise. That is what lets a
    // `load()` stream: `{"lentes": chercher_lentement()}` returns a coroutine,
    // and SvelteKit waits on the promise it turns into.
    if (pyCoroutine(value)) {
        // A walk that cannot wait must not start one.
        //
        // The JSON rule is a serialiser's, and a serialiser is synchronous: it
        // met the branch below, scheduled the body, and handed `JSON.stringify`
        // a promise, which has no enumerable property — so `tojson(work())`
        // answered `{}` while **running the author's coroutine**. A valid string
        // that says nothing, and a side effect nobody asked for.
        //
        // The caller's own rule decides, before anything is scheduled: the
        // serialiser refuses this shape the way it refuses a class and a call.
        // Every other caller hands its result to JavaScript, where a promise is
        // exactly what is wanted.
        if (adapt !== undefined && seen instanceof Set) return adapt(value);

        // One coroutine object, one run. This branch sits before the graph memo
        // and had none of its own, so a coroutine held under two keys was
        // started twice: two promises, and the Python body executed twice —
        // counted, not inferred. Whatever the body does on the way, it did
        // twice.
        //
        // Memoised on the coroutine itself rather than inside a traversal,
        // because that is the truth being told: awaiting one coroutine twice is
        // not something Python offers, so two references to it cannot mean two
        // runs under any rule, JSON included. Two distinct coroutine objects are
        // two distinct keys here, and still run once each.
        let crossing = CROSSED.get(value);

        if (crossing === undefined) {
            crossing = { run: scheduleAsync(value, 'coroutine'), views: new Map() };

            CROSSED.set(value, crossing);
        }

        let view = crossing.views.get(adapt);

        if (view === undefined) {
            // What it resolves to is Python too, and has to make the same
            // crossing, under the same rule: the policy used to stop at the
            // `await`, so `nested({"done": f})` worked and the same dict behind
            // a coroutine handed JavaScript a bare Python function, which raised
            // on the argument it was called with.
            view = crossing.run.then((result) => plainData(result, undefined, adapt));

            crossing.views.set(adapt, view);
        }

        return view;
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
    // is the default because five of the six consumers are on this side —
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
    // shell: a Python class, and anything carrying a prototype of its own — a
    // Date, a Map, a Promise, a Response. The shell registered above was then
    // never filled, and the *second* reference to that same value met it:
    // `[d, d]` crossed as `[Date, {}]`, and `{"a": d, "b": d}` gave a real date
    // under one key and an empty object under the other.
    //
    // Registering before the walk is what answers a cycle, so it stays; what was
    // missing is that the memo has to end up holding whatever `branch` decided,
    // not what was guessed before it decided.
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
        // too, and a component that renders `rows` one way and exports it the
        // other is the same defect twice.
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
    // slot is an own property named `slot_value_<name>`. So this walk found no
    // `__dict__`, fell through to the mapping below, and handed JavaScript the
    // engine's own view of the object — `{ob_type, slot_value_rows}`, which
    // `JSON.stringify` then refuses as circular through the class. Adding
    // `__slots__` to a model renamed its data and made the result
    // unserialisable, for an object whose Python API had not changed.
    //
    // Both sources and not one: `__slots__` may name `__dict__`, and then an
    // instance has slots *and* a dict. A dict of the author's is stepped over,
    // since `{"slot_value_x": 1}` is data and not storage.
    const attributes = ownAttributes(value);
    const holder = attributes !== null && typeof attributes === 'object' ? attributes : undefined;
    const slots = declaresSlots(value)
        ? Object.keys(value).filter((key) => key.startsWith(SLOT))
        : [];

    // A mapping is its entries, whatever else it also is.
    //
    // `class Mapping(dict): pass` gets an instance `__dict__` beside its items,
    // so this branch answered first and returned before the mapping below was
    // ever read: `Mapping({"answer": 42})` crossed as `{}`, and with one
    // attribute set, as `{label: "metadata"}` — the data replaced by metadata
    // about it, with no error and valid JSON on the other side.
    //
    // Entries only, which is the rule CPython's own `json` follows for a dict
    // subclass: an attribute on the instance describes the mapping and is not an
    // entry of it, and merging the two would invent keys the mapping does not
    // have.
    const mapping = globalThis.__BRYTHON__.is_dict(value);

    // A value that **descends from a builtin** is not an instance of the
    // author's, and the difference decides which of the two rules below it gets.
    // A `complex` has an instance dictionary and it is empty, so the fields path
    // wrote `{}` for it: the same silent loss as a Map, from the arm written to
    // serialise what an author put on their own object.
    //
    // Asked of the **MRO**, not of the class by identity, which is the mistake
    // this file has now made four times and repaired three: `class Money(complex)`
    // is not the entry in Brython's table, so it answered no and came out as its
    // attributes — `{}`, or `{"label":"kept"}` with one field on it, the number
    // gone. Asked against Brython's own table rather than a list of type names
    // written here, and `object` is excluded because every class descends from
    // it.
    const owned =
        pyClass(value.ob_type) &&
        Array.isArray(value.ob_type.tp_mro) &&
        value.ob_type.tp_mro.some((one) => one !== _b_.object && _b_[one.tp_name] === one);

    if (!mapping && !owned && (holder !== undefined || declaresSlots(value))) {
        const fields = shell ?? {};

        if (holder !== undefined) {
            for (const key of Object.keys(holder)) {
                define(fields, key, plainData(holder[key], seen, adapt));
            }
        }

        // Under the name the author wrote, which is what the same class without
        // `__slots__` hands over.
        for (const key of slots) {
            define(fields, key.slice(SLOT.length), plainData(value[key], seen, adapt));
        }

        return fields;
    }

    // Asked of Python, through `pyEntries`, which walks the hash table as well as
    // the properties. This site read the properties alone, and the comment that
    // stood here said a dict keeps its keys there — which is true of the string
    // ones and of nothing else. So `{1: "janvier", 2: "février"}`, which is what
    // anyone writes for a lookup table, crossed as `{}`: no error, no warning, no
    // partial result, through `to_js`, through `tojson`, and through every Python
    // function's return value.
    //
    // The walk this replaced touched **no** symbol, and this one touches two:
    // `$B.is_dict` reads `Symbol(OB_TYPE)` — it does not answer from a flag, and
    // a comment here said it did — and the iteration reads `ob_type` besides.
    // Measured on a recording proxy, with the old walk as the control.
    //
    // The property that mattered is still safe, and at another site: SvelteKit
    // wraps `event.params` in a proxy that records every key read, and `pyDict`
    // snapshots it at the *inbound* boundary, so Python holds a plain dict and
    // this function never meets the proxy. The defence is real; it does not live
    // here, and claiming it here was how the last defect stayed hidden.
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
    // representation here, and walking its properties reads the engine's. That
    // is where `<class 'range'> is a class` came from, and `{}` for a complex —
    // the class accusation and the silent loss, from one line, at every builtin
    // nobody had named yet. CPython refuses the same values: *Object of type
    // range is not JSON serializable*.
    //
    // A question rather than a third list of type names, which is how `set` and
    // `bytes` were each found one at a time. The two of them keep their own arms
    // because their sentences name the way out; this one names the class.
    if (adapt !== undefined && seen instanceof Set && !mapping && pyClass(value.ob_type)) {
        return adapt(value);
    }

    const out = shell ?? {};

    for (const [key, one] of pyEntries(value)) {
        define(out, propertyName(key, out), plainData(one, seen, adapt));
    }

    return out;
}

// The name a Python key takes as a JavaScript property, and the refusal that
// belongs with it.
//
// Two sites write a mapping out: this converter, and the export branch that
// adapts a dict holding a function. The second spelled its keys by handing the
// Python object to `define` and letting JavaScript coerce it, which skipped both
// halves of the rule: `{1: "numeric", "1": "text", "fn": f}` crossed as a single
// `"1"` key holding `"text"`, silently, while the same dict without the function
// raised. A rule that lives at one of two sites is the shape of defect this file
// keeps meeting, so it lives here and both ask.
function propertyName(key, out) {
    // A JavaScript property name is a string, and a Brython float is an object,
    // so `{1.5: "x"}` would otherwise be keyed by `[object Object]`.
    const name = String(plainData(key));

    // Two keys Python keeps apart that JavaScript can only spell one way. The
    // narrowing is the destination's, but the silence would be ours, and this
    // project's own rule for the moment is written one file over: a serialiser
    // meeting something it cannot serialise owes the author a sentence.
    if (Object.hasOwn(out, name)) {
        const error = new Error(
            `svelthon — this dict has two keys JavaScript cannot tell apart: ` +
                `\`${name}\` is what both of them spell as a property name. A ` +
                `JavaScript object has string keys only, so one would silently ` +
                `replace the other on the way out.`
        );

        error.$svelthon = true;

        throw error;
    }

    return name;
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

    // A Brython list and a Brython tuple are JavaScript arrays too, told apart
    // from a foreign one by the `ob_type` they carry. Rebuilding one made a list
    // of a tuple — the immutability went, and with it the right to be a dict key
    // — and made a copy of a list, so a guard put on data that turned out to be
    // Python's already quietly detached it from the name it came from.
    //
    // A foreign array is rebuilt, and a JavaScript array belongs to a graph
    // rather than to a tree: `xs.push(xs)` answered `RangeError: Maximum call
    // stack size exceeded`, and `[shared, shared]` gave two lists where there
    // was one. So each array is registered *before* its children are walked, and
    // whatever the graph does afterwards finds the list already made.
    if (Array.isArray(value)) {
        // Asked of the *class*, like the object branch below and for the same
        // reason: `ob_type` is a field name, and an array is as free to carry
        // one as an object is. A JavaScript array with a business field of that
        // name was taken for a Brython list and handed back unconverted, so
        // `to_py(rows)` gave something that is not a `list` and the Python
        // beside it raised `AttributeError` on `.get`. The repair the object
        // branch received at the forty-second reading, one branch further.
        if (pyClass(value.ob_type)) return value;

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
    // *its* frames — measured identically through `$B.jsobj2pyobj` alone — and
    // two references to one object came back as two dicts. The array branch
    // above was written for exactly that, and stopped at arrays; a cycle does
    // not have to be *in* an object for the object branch to be the one that
    // meets it, since `{"xs": [o]}` enters here.
    //
    // The silent face is the one that matters: this framework updates by
    // mutation, so two names that stop being one thing is a write that stops
    // arriving.
    //
    // Only a plain object. A Date, a Map, a Response, a DOM node and anything
    // Python already owns keep the crossing they had.
    //
    // Asked as `plainObject`, which is the predicate written for exactly this
    // question one page up. The comparison used to be spelled out here as well,
    // so the outbound walk learned to recognise another context's object and the
    // inbound one did not: the same value became a dict going one way and a
    // `JSObject` coming back. One rule, one site.
    //
    // "Is this already a Python object" was asked as `ob_type === undefined`,
    // which is a *field name* and therefore something data is allowed to carry:
    // `{"ob_type": "business", "value": 42}` is ordinary JSON and took the
    // branch meant for Brython's own objects. A real Python object carries a
    // class there, so the question is asked of the class.
    if (!pyClass(value.ob_type) && plainObject(value)) {
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
    // `PYOBJ` WeakMap is for, and a dict has no `to_dict`. Asking for it
    // unconditionally made `to_py` raise on every value that did not need
    // converting, so it was no use as the guard on a boundary, which is the one
    // place anyone would reach for it.
    // Only for something that needed converting. `jsobj2pyobj` hands back the
    // *same* object when the value was already Python, and a Python instance
    // that happens to define `to_dict` — an ordinary serialisation helper —
    // answered a **bound method**, which is an object, not a JavaScript
    // function: `to_py(value)` raised `toDict is not a function` on a value it
    // was supposed to leave alone. Identity is the test, and it is the truth
    // being told: nothing was converted, so there is nothing to finish.
    if (python === value) return python;

    // **Not reachable from a component, and kept as a belt.** Everything a
    // component can hand this — `js.JSON.parse(…)`, the answer of a `__js__`
    // import — has already crossed `inbound`, so `jsobj2pyobj` gives the same
    // object back and the line above returns first. A mutation sweep says so:
    // inverting the test below calls `null()` on every conversion and no test
    // can tell, because no reachable input gets here. `tests/to-py.test.js`
    // covers what an author can actually write.
    const toDict = $B.$getattr(python, 'to_dict', null);

    return toDict === null ? python : toDict();
}

// Does it behave like a URL — asked somewhere a throw is expected rather than
// fatal.
//
// Two failures, one on each side, produced this shape. Reading
// `url.searchParams.get` threw during prerendering, where SvelteKit hands over a
// **proxy** and refuses the one part of a URL a page built ahead of time cannot
// have, so the recognition threw before the fallback it guards could run.
// Replacing that with `instanceof URL` traded the throw for a **realm**: a URL
// built in another JavaScript context answers everything a URL answers and fails
// the identity, so a genuine event crossed as an ordinary object and the Python
// handler raised on `event['method']`. The comment below already said exactly
// that about `Request`, which made it my own contradiction rather than a
// surprise.
//
// So a behaviour again, and the `try` is what keeps the first failure closed:
// whatever a guarded member does, it does not escape from here.
//
// A throw answers **no**, and that was the other way round for a day. *A guarded
// member is still a URL* sounds right and admits every object whose getter
// throws, which is a recognition widened by an accident rather than by a
// measurement — and the failure it trades against is the mild one. Refusing a
// genuine event is loud: the handler raises on `event['method']` and the author
// reads a Python error. Admitting a business object is silent: its fields
// disappear and the page is merely wrong. Between a loud wrong answer and a
// quiet one, take the loud one.
//
// The path and the scheme rather than the query, because those are the parts a
// prerendered page necessarily has — it is rendered *for* a path — so no member
// SvelteKit is known to guard is read at all.
//
// And a URL is **a value of a class**, never a bag of keys, which is the
// question `plainObject` was written for and which `plainData` already asks to
// decide what it may flatten. Two strings are cheap to write down, and the
// fourth reading of this line did exactly that: an ordinary HTTP context whose
// `url` was `{pathname, protocol, href, searchParams}` — with a real Request, a
// fetch and params beside it — passed every other test and lost its own fields.
// Every URL a framework hands over carries its own prototype, our realm's or
// another's; only an imitation is built out of Object.
const urlish = (value) =>
    typeof value?.pathname === 'string' &&
    typeof value?.protocol === 'string' &&
    !plainObject(value);

// A SvelteKit request event, recognised by what its members *are*.
//
// The line this replaces asked whether three names were truthy — `params`,
// `url`, `request` — and three names are not rare. A business object carrying
// them was reclassified: its own fields vanished from the level Python reads,
// `value.payload` was gone, and nothing raised. Data went missing and the page
// was merely wrong.
//
// Names are cheap; behaviour is not. A URL answers with a path and a scheme, a
// Request answers `headers.get` and carries a string method, and `fetch` is the
// member SvelteKit puts on every event and no data structure has any reason to
// hold. So four independent things have to be true at once, and an object that
// is all four is a request event whatever it was built by — which is the point,
// since an adapter may hand over a `Request` from another realm, where
// `instanceof` answers false for the genuine article.
//
// `params` last, and only that it is an object: it is the field a route with no
// parameters leaves empty, so it can say the least.
//
// **The whole probe is inside the `try`, not one member of it.** The rule was
// written for `url` alone, where a prerendered page's guarded `searchParams`
// threw — and every other member here is a property read on an object nobody
// vouched for. A business object with a lazy or guarded `fetch` raised from the
// recognition itself, before the Python function that only wanted its `payload`
// ever ran. Asking what something is must not be able to fail: a throw is a
// **no**, for the same reason as one member down, since refusing a genuine
// event is loud and admitting a business object is silent.
const routeEvent = (value) => {
    try {
        return (
            typeof value.fetch === 'function' &&
            urlish(value.url) &&
            typeof value.request?.method === 'string' &&
            typeof value.request?.headers?.get === 'function' &&
            value.params !== null &&
            typeof value.params === 'object'
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
    // receiver, which Node refuses — *Receiver must be an instance of class
    // URL*. A getter read goes through the trap with the real URL underneath it,
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

    // `?tag=a&tag=b` is one key twice, and a dict holds one value for it. Which
    // one was decided by nothing: the pairs went in in order and the last
    // overwrote the first, so `event["query"]["tag"]` answered `b` while
    // `event["js"].url.searchParams.get("tag")` answered `a` — two views of one
    // request, disagreeing, inside the same event.
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
// The line that stood here said this was already the only place that starts a
// coroutine. It was not — `schedule` still had a call of its own for one pass,
// so a handler returning a shared coroutine ran its body again on every event,
// while the same object returned by an export ran once. The sentence was true of
// the intention and false of the file, and an audit read it before the code
// caught up.
//
// The reason for centralising: `pyCall` handed a returned coroutine straight to
// `aio.run`, so the same object returned twice ran its body twice while the same
// object inside a returned dict ran once. A Python coroutine is not freely
// re-runnable, and this project has already chosen to share one execution.
//
// The run rejects with Python's own error and nothing else; the position is
// added by each caller below. **The trade is real and measured**: `pyError`
// describes an exception once and returns it untouched afterwards, so when one
// coroutine is handed out by two routes the *label* is the first asker's — a
// coroutine met inside data is labelled `coroutine`, and an export that awaits
// the same object afterwards inherits that label. The line stays the author's,
// since it comes from the traceback and not from the label. Running the body
// twice to give each caller its own label is the thing this replaced.
const RUNS = new WeakMap();

function started(coroutine) {
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

export function scheduleAsync(result, where, lineOffset = 0) {
    const $B = globalThis.__BRYTHON__;
    const aio = $B.imported['browser.aio'];

    if (!aio || result === undefined || result === null) return result;
    if (!pyCoroutine(result)) return result;

    return started(result).catch((error) => {
        throw pyError(error, where, lineOffset);
    });
}

// A copy that is still whatever it was, so the original stays Python's.
//
// Measured, and the two halves are not interchangeable. A Brython dict keeps its
// items as own properties beside three symbol-keyed internals, and
// `Object.create` with its descriptors gives back something `repr` still prints
// as a dict. A Brython list is a real array carrying `ob_type` beside its items,
// and `Object.create` cannot make an array: exotic `length` is not a descriptor,
// so the copy came back with `Array.isArray` false and stopped being a list to
// everyone but `get_class`.
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
// **On a copy, and only once one is needed.** This used to write back into the
// object it was handed, which is the caller's: an `@export` returning state that
// Python also keeps had that state downgraded in place, and Python then read a
// `JSObject` where it had put a float. `str(x)` still printed `0.25`, so the page
// went on rendering correctly while `round(x, 1)` raised. The copy is built on
// the first replacement and not before, so the common case, a transition dict of
// plain numbers, allocates nothing.

export function pyNumbers(value) {
    // A JavaScript function Python held through its adapter goes out as itself.
    // `None` itself is a singleton and not a container: walking its own
    // properties would copy it, and the copy is no longer `None`.
    if (value === null || typeof value !== 'object' || value === NONE) return value;

    // Nor is a callable: a bound method is `{ob_type, im_func, im_self}`, and
    // walking it as a config replaced its `im_func` with a JavaScript wrapper,
    // so the method was no longer one to the boundary that received it. It
    // goes on whole, and that boundary adapts it.
    if (callable(value)) return value;

    const alone = pyScalar(value);

    if (alone !== undefined) return alone;

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
            // as raw JavaScript numbers, and Brython reads a number as an int.
            // So `tick(0, 1)` works, since 0 and 1 *are* integers, and the first
            // frame after it raises `0.0026 can't be converted to BigInt`,
            // which is what a transition that plays once and then stops is.
            //
            // Asked as `callable` and not as `typeof one === 'function'`, which
            // is the test every other boundary has stopped using: a bound method
            // is an object, so `{'tick': ticker.tick}` handed the framework
            // something it could not call at all, beside a `duration` converted
            // correctly. `pyHandler` binds the receiver and reads the signature;
            // the numbers are converted on the way in as before.
            // Through `pyHandler` whatever the shape, because the adaptation is
            // not only about being callable: `pyCall` converts what the callback
            // *returns*, and an ordinary Python function kept its Brython float
            // — `easing(0.5)` handed Svelte an object whose `value` was 0.25,
            // and `t1 + delta * easing(...)` answered NaN. The bound method
            // beside it was right, since it already went this way.
            //
            // A function JavaScript built is left alone — and *left alone* has
            // to mean the arguments too. `pyHandler` hands back anything
            // `declared` does not recognise, and this line wrapped it again to
            // convert what it is called with: a library's own
            // `t => t.toFixed(2)`, handed through a Python component, was given
            // a Brython float, so `Number.isFinite` answered false and
            // `toFixed` raised. The conversion is what a *Python* callback needs
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
        // it, so a plain `out[key] = …` threw `Cannot set property bump of
        // #<Object> which has only a getter`. It went unseen because the one
        // path that reaches it is a `bind:this` teardown, and until the tests
        // began unmounting, no teardown ever ran.
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
// Nine functions below carry a value between Python and JavaScript, and each
// applies some part of the same five treatments. Every choice is argued beside
// the function it belongs to, and that is the right place for a *reason*; it is
// the wrong place for a *comparison*, because the choices are not independent.
// Whether a `load()` converts its result and a DOM handler does not is one
// decision taken nine times, and nobody could see it without this table.
//
//                | arity | args in  | coroutine | result out | memoised |
//   pyCall       |  yes  | pyArg    | awaited   | plainData  |          |
//   pyHandler    |  yes  | pyCall, with the arity read off the signature  |
//   pyEvent      |  yes  | pyArg    | fired     |            |          |
//   pyBoundary   |  (a)  | restored |           |            |   yes    |
//   pyModule     |  yes  |          |           | pyNumbers  |   yes    |
//   pyExport     |       |          |   (b)     | plainData  |   yes    |
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
// (a) `pyBoundary` does not trim. It copies `$function_infos` onto its wrapper
//     so that whoever calls it later still can: losing them would leave every
//     caller downstream handing a Python signature more arguments than it takes.
// (b) `pyExport` hands a coroutine to `plainData`, which schedules it and
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
// The trim is the boundary's contract — it is what lets a framework hand an
// event to a callback that never asked for one — and `pyArg` is the conversion
// every call boundary owes. The three wrappers below wrote both out, and two of
// them were missing the second half until an action took a JavaScript number and
// `format(value, ".2f")` refused it at mount.
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
// arity, and it answered 0 for a `def` given three parameters, because a
// function that takes a rest parameter — which every wrapper here is — declares
// nothing.
//
// The arity was measured and reverted once, for a reason that has since gone:
// a module's own functions were wrapped by the compiler, in a string, so only
// some routes could have carried it and `three` would have answered 0 at the
// top level and 3 from inside a list — the very asymmetry the name was repaired
// for. Every wrapper a JavaScript caller can hold is built here now, so one
// place covers every route and the generated code pays nothing.
//
// `Infinity` keeps the 0: `*args` has no number to report, and 0 is what
// JavaScript says of a rest parameter.
const identified = (wrapper, name, arity) =>
    Object.defineProperties(wrapper, {
        name: { value: name, configurable: true },
        length: { value: Number.isFinite(arity) ? arity : 0, configurable: true }
    });

// A module's own `def`, published under its name.
//
// The line this replaces called `__fn_name` straight, with the arity the
// compiler read off the **AST of the `def`**, and both halves of that are a bet
// that a name still holds what its `def` declared. A decorator is exactly what
// makes it false, and `decorators are identity` is a rule this project has
// written down elsewhere:
//
//   - `@collect def decorated(value)` where the decorator answers a `*values`
//     function: Python counted three arguments, the alias counted three, and
//     this export trimmed to **one** before the decorator ever saw them;
//   - `@as_object def one(value)` where the decorator answers a **callable
//     instance**: Python called it, the alias called it, and this export raised
//     *not a function*, because the emitted call was a JavaScript call on a
//     value that is an object here.
//
// The alias path had neither defect, and it is the whole repair: `alias = fn`
// goes through `pyHandler`, which asks the **value** what it is and what it
// takes. So this reads the binding at the call — the late binding the old arrow
// was written for — and then takes the alias's road. One rule, and the name a
// `def` was given stops being a claim about what is behind it.
//
// `length` is read once, here, because a JavaScript function's is a number and
// not a question; what a caller actually gets is trimmed against the value at
// the call. A name rebound afterwards therefore reports the old `length` and
// behaves as the new value: the honest half is the behaviour.
//
// And a `def` whose name no longer holds a Python callable once the module has
// run, replaced by what a decorator returned or by a later assignment, is
// published as that value, as `pyExport` publishes any other.
export function pyDef(read, where, lineOffset = 0) {
    const value = read();
    const first = declared(value);

    if (first === null) return pyExport(value, where, lineOffset);

    return identified(
        (...args) => pyHandler(read())(...args),
        nameOf(where),
        first === null ? 0 : arityNow(first.arity)
    );
}

export function pyCall(fn, where, lineOffset = 0, arity = Infinity, named, convert = pyArg) {
    const wrapper = (...args) => {
        try {
            const given = taken(args, arity, convert);
            const result = scheduleAsync(fn(...given), where, lineOffset);

            // The result crosses under the same rule as an export, callbacks
            // included.
            //
            // It used to cross with no rule at all, so a callable *returned by*
            // an exported function was not adapted while the same value exported
            // directly was: `factory()` handing back `handler.run` gave
            // JavaScript an object it could not call, and an ordinary function
            // came back with Python's raw contract — an argument it never
            // declared raised, and what it answered was a Brython float rather
            // than a number. One value, two contracts, decided by whether it was
            // published or returned.
            //
            // Noted at the twenty-ninth reading as a limit and carried since;
            // what makes it a defect rather than a limit is that the rule
            // already exists, one line away, and every other crossing passes it.
            // `await` rather than `result.then`, because a bare thenable's
            // `then` answers whatever its author wrote — `undefined` for the
            // three-line shape everyone writes — and what a caller was handed
            // has to stay awaitable. The async function hands back one promise
            // of this realm for every shape.
            //
            // The conversion of a resolved value runs after this `try` has
            // returned, so it carries its own: a refusal there names the call
            // the way the same refusal does for a value returned directly.
            const pending = awaited(result);

            if (pending === undefined) return plainData(result, undefined, pyHandler);

            return (async () => {
                const one = await pending;

                try {
                    return plainData(one, undefined, pyHandler);
                } catch (error) {
                    throw pyError(error, where, lineOffset);
                }
            })();
        } catch (error) {
            throw pyError(error, where, lineOffset);
        }
    };

    // The name a JavaScript caller reads: in a log, in a stack, in a library
    // that dispatches on it, and in this project's own refusals. A function
    // expression carries the name of the binding it is assigned to and nothing
    // else, so one Python `def` answered `plain` at the top level of a module —
    // where the compiler emits `const plain = …` — and `""` from inside a list,
    // for the same function. The message that had to say *what* it was refusing
    // was the first consumer to notice, and it will not be the last.
    //
    // The two own properties every JavaScript function has, and both of them
    // were saying something about the framework rather than about the call.
    //
    // **`name`**: what Python recorded, read off `$function_infos` rather than
    // off `fn.name`, since a module's functions cross through `pyBoundary`,
    // whose wrapper is named after a local of this file — `fn.name` answered
    // `wrapped` for every one of them. `named` is what a caller holding the
    // `declared` answer passes: the callable's own label, `Box.save` or
    // `Handler.__call__`, where `where` is the *export's* label. Without it a
    // callable published inside a dict was named after **the dict**, so
    // `{"h": handler}` reported `holder` — a name taken from wherever the walk
    // began rather than from the value.
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
// A function read off *another* module, `helpers.click` as a handler, does not
// arrive as the accessor's own wrapper. `$B.imported` holds a plain JavaScript
// object, so Brython's interop wraps the function again, and that wrapper
// carries a `$function_infos` of its own with nothing in it but a name. It
// passes an `Array.isArray` guard and then trims to `undefined`, which trims
// nothing: `onclick={helpers.click}` called `click(event)` on a `def click()`.
//
// The original is kept on `$js_func`, and it is the one that answers for the
// signature, which is why `pyBoundary` carries `$function_infos` too.
// An instance whose class defines `__call__`, which is an ordinary way to write
// a strategy object and the third shape of *callable in Python*. Answers with
// the `__call__` it found, since that is what carries the signature.
//
// Asked of the class chain, never of the instance: `declares` reads the class
// dictionaries of the MRO, so no getter of the author's runs while a value is
// merely being converted. Measured against CPython on the same question — a
// plain instance, a list, a dict and a str all answer no, and a class that
// defines `__call__` answers yes.
//
// The chain is the word that was missing. This line asked `search_in_dict`
// directly, which reads one dictionary: `class Strategy: __call__` was callable
// and `class Derived(Strategy): pass` was not, at all five boundaries at once —
// argument, option, export, mapping, config — and nothing said so, since what
// arrives is an object JavaScript simply cannot call.
//
// A **class** is excluded on purpose, and the exclusion is not decorative:
// measured, `type` *does* carry `__call__` in Brython, so without this line
// every class named in `__all__` reaches `declared` and is saved only by
// `type.__call__` having no `$function_infos`. A class crossing as itself rather
// than as a wrapper is a decision this file already made, and it should not rest
// on the shape of an engine internal.
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
// day this one learns another shape — which it has done twice.
export const callable = (value) =>
    typeof value === 'function' ||
    boundMethod(value) ||
    wrapperMethod(value) ||
    callDescriptor(value) !== null ||
    slotCallable(value);

// Any other value Python calls: `list.index`, `list.__setitem__`, the
// descriptors a builtin type hands out, which Brython calls through a `tp_call`
// slot. Python's own `callable()` answers, a class excluded, since a class
// crossing is the class.
const slotCallable = (value) =>
    pyType(value) !== undefined &&
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
    value.ob_type === globalThis.__BRYTHON__.method_wrapper &&
    typeof value.wrapped === 'function';

// A method read off an instance: `{ob_type: method, im_func, im_self}`, which
// `typeof` calls an object. Recognised by its class the way everything else
// here is, and not by the two field names, which are Brython's own
// (`descriptors.js`, `$B.method.tp_new`).
const boundMethod = (value) =>
    value !== null &&
    typeof value === 'object' &&
    value.ob_type === globalThis.__BRYTHON__.method &&
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
    const call = method === null ? callDescriptor(value) : null;

    if (method === null && call === null && typeof value !== 'function') return slotDeclared(value);

    // `@staticmethod def __call__` is kept in the class dictionary as the
    // descriptor Brython builds for it — `{ob_type, sm_callable}`, the function
    // under the second name — and this line read it as if it were the function.
    // The signature test then failed and no adapter was built: Python called the
    // instance perfectly well and JavaScript was handed an object.
    //
    // Unwrapped here rather than in `callDescriptor`, because what travels with
    // it is the **arity**: a static call takes no receiver, so `self` is not
    // among the parameters to drop, and dropping one anyway would have traded
    // this defect for an off-by-one in the next.
    //
    // `@classmethod def __call__` is the same shape under `cm_callable`, and its
    // receiver is the class, one parameter to drop like `self`.
    const stat = call !== null && call.sm_callable !== undefined ? call.sm_callable : null;
    const held = method !== null ? method.im_func : (stat ?? call?.cm_callable ?? call ?? value);
    const fn = typeof held.$js_func === 'function' ? held.$js_func : held;
    const infos = fn.$function_infos;

    // Nothing of Python's at all: a function JavaScript built, which crosses as
    // the object its library made. Unless the value is Python's and its call is
    // native, the `__call__` a `method_descriptor` inherits: `list.index`.
    if (!Array.isArray(infos)) return method === null ? slotDeclared(value) : null;

    // Python's, but with no signature to read: a **builtin**. `round` carries
    // `["builtins", "round", "round"]` and no arity, because it is written in
    // JavaScript inside Brython rather than compiled from Python.
    //
    // *No signature* was read as *not Python's*, so `rounded = round` published
    // by a module was handed over untouched, exactly as a library's own function
    // is — and then a JavaScript caller passing `0.25` got *type Javascript
    // Number doesn't define __round__ method*. The two decisions are separate:
    // not knowing what a function takes says nothing about what it *expects*,
    // and a builtin expects Python on both sides.
    //
    // `Infinity` is the honest arity: there is no number to trim to, so
    // everything is passed and the conversion does the rest.
    if (!infos[8] && typeof infos[10] !== 'number') {
        // A builtin under a `__call__`, `staticmethod(abs)`, or under a bound
        // method: the object is called through Python's own protocol, as a
        // builtin type's descriptor is.
        if (method !== null || call !== null) return slotDeclared(value);

        const where = `${infos[1]}() — ${infos[0]}`;

        // A builtin **bound to a receiver**: `rows.append`, which Brython builds
        // fresh on every read as a `builtin_method` carrying `m_self`. It is the
        // third representation of a bound method in this engine, and the one
        // that fell through to the plain-function road, where the cache key is
        // the function it was handed. So two reads were two JavaScript
        // functions: `off(rows.append)` could not find what `on(rows.append)`
        // had added, the listener stayed in the registry, and the next event
        // appended to the list a second time.
        //
        // Same identity as an ordinary bound method, one paragraph down: the
        // pair, receiver and operation. The operation is `$function_infos`
        // itself, which is a property of the native function the descriptor
        // wraps, so it is one object per operation and shared by every receiver
        // — `rows.append` and `other.append` name the same operation, and
        // `rows.clear` a different one, which is exactly the distinction a
        // registry holding two lists needs.
        // Whatever the receiver's representation: `"hello".upper` is bound to
        // a JavaScript string, and `perReceiver` keys it by value.
        if (value.m_self !== null && value.m_self !== undefined) {
            return { fn, where, arity: Infinity, origin: infos, self: value.m_self };
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
    // site, so everything downstream — the wrapper, the arity trim, the error
    // position — reads a function of the caller's arity like any other.
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

    // The instance, whose call is looked up **at every call** and whose contract
    // was read once.
    //
    // The paragraph above says `$B.$call` is right for a `__call__` reassigned on
    // the class after this wrapper was built, and it was right about the body and
    // wrong about the arguments: `Strategy.__call__ = changed` ran the new body
    // with the old signature's trim, so the argument the new one needs had
    // already been sliced off. Python answered 5 and the same callback from
    // JavaScript raised about a missing parameter.
    //
    // So the two halves move together: the arity goes upward as a question,
    // asked at each call against whatever the class holds now, and the wrapper
    // that trims asks it before converting anything. The wrapper's identity is
    // untouched, which is what a registry that holds a callback needs.
    return {
        fn: (...args) => globalThis.__BRYTHON__.$call(value, ...args),
        where,
        arity: () => liveArity(value),
        origin: fn,
        self,
        // What the author called it, when they called it anything.
        //
        // A JavaScript function has a `name` whether or not anyone chose one, so
        // the choice is which word to put there, not whether to. `Handler.__call__`
        // is the class's; `self.name` is the author's, and `on_save` says more in
        // a log than the qualname of the method that runs it. It is not a field
        // crossing — no field crosses on a callable — it is the better of two
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

    if (call === null) return Infinity;

    const stat = call.sm_callable !== undefined ? call.sm_callable : null;
    const held = stat ?? call.cm_callable ?? call;
    const fn = typeof held.$js_func === 'function' ? held.$js_func : held;
    const infos = fn.$function_infos;

    if (!Array.isArray(infos) || (!infos[8] && typeof infos[10] !== 'number')) return Infinity;

    return infos[8] ? Infinity : infos[10] - (stat === null ? 1 : 0);
}

// What to call a Python function in a message, which neither `__name__` nor
// `str()` can answer: a module's functions cross through `pyBoundary`, and its
// wrapper answers `wrapped` and `<JavascriptFunction object>` — the name of a
// local in this file, and a category. `$function_infos` travels with the
// wrapper, which is why it is read here instead.
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
export function pyEvent(value, lineOffset = 0) {
    const found = declared(value);

    // Not a Python function, so there is nothing to wrap, and the value is on
    // its way to a DOM boundary like any other: `bound` is what turns None into
    // undefined there. Returning it untouched leaked the None object into every
    // attribute the handler test claims, and it claims more than handlers:
    // `on` followed by a lowercase letter also catches `once`, `only` and
    // `onboarding`, which Svelte 5 makes defensible for a component prop and
    // which was the one place `__bound` did not reach.
    if (found === null) return __pybridge.bound(value);

    const { fn: called, where, arity } = found;

    // The offset is the number of lines before `<script lang="python">`, known
    // only to the generated script: without it an error in a handler names a
    // line counted from the tag rather than from the top of the file.
    return (...args) => {
        try {
            return schedule(called(...taken(args, arity)), where, lineOffset);
        } catch (error) {
            throw thrown(pyError(error, where, lineOffset));
        }
    };
}

// One Python function, one JavaScript function.
//
// A fresh wrapper per crossing is invisible until something compares two of
// them, and JavaScript's own APIs do: `removeEventListener` takes the function
// it was given, and so do `off`, `unsubscribe` and every deduplicating
// registry. `on(handler)` then `off(handler)` handed over two different
// functions for one Python name, so the listener stayed, the next `on` added a
// second, and one event ran the body twice. Counted, not inferred.
//
// Keyed on `found.fn`, the function Brython recorded the signature of, and not
// on the object that arrived: reading `helpers.click` twice gives two interop
// wrappers around one function, and Python calls them the same name. Every
// wrapper this site builds has the same contract — `pyCall(fn, where, 0,
// arity)`, all three read from `fn` itself — so one per function is the whole
// of it. A bound method rebuilt at each read is a different question and is not
// answered here.
const HANDLERS = new WeakMap();

// And for a bound method, one level deeper: receiver, then function. Two maps
// rather than a composite key, because both halves have to be weak — a receiver
// is an ordinary object of the author's and holding it would outlive the page.
const RECEIVERS = new WeakMap();

// And for an instance whose class defines `__call__`, keyed on the instance
// itself: what it is does not change when the class changes what it does.
const INSTANCES = new WeakMap();

// The body of a derived, an effect or an `inspect`, called the way Python calls
// it: a decorator may have made it a callable instance or a bound method, which
// are Brython objects and not JavaScript functions. A function is called as it
// is, which is the path every undecorated body takes.
export const invoke = (fn) => (typeof fn === 'function' ? fn() : globalThis.__BRYTHON__.$call(fn));

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
// not changed. The identity is the one `pyHandler` settles — a function, a
// receiver and its method, an instance — so the two cannot disagree, and it is
// held weakly.
const ATTACHED = new WeakMap();

export function pyAttach(value, lineOffset = 0) {
    const found = declared(value);

    if (found === null) return __pybridge.bound(value);

    const identity = pyHandler(value);
    let byOffset = ATTACHED.get(identity);

    if (byOffset === undefined) ATTACHED.set(identity, (byOffset = new Map()));

    let attach = byOffset.get(lineOffset);

    if (attach === undefined) {
        const { fn: called, where, arity } = found;

        attach = (...args) => {
            try {
                return pyTeardown(called(...taken(args, arity)), where, lineOffset);
            } catch (error) {
                throw thrown(pyError(error, where, lineOffset));
            }
        };

        byOffset.set(lineOffset, attach);
    }

    return attach;
}

export function pyTeardown(value, where, lineOffset = 0) {
    if (pyCoroutine(value)) {
        schedule(value, where, lineOffset);
        return undefined;
    }

    const cleanup = pyHandler(value);
    return typeof cleanup === 'function' ? cleanup : undefined;
}

// **Every Python callable the engine hands to JavaScript goes through
// `pyHandler`.** Brython converts the arguments of any JavaScript call it makes
// — a method of a namespace or of an object a library returned or resolved, a
// constructor through `.new`, a property written, a global like
// `setTimeout` — with its own `pyobj2jsobj`, whose callback trims nothing, so
// a callback that takes no argument raised on the one a library hands it, and
// which is not the function `pyHandler` publishes for the same callable.
// Marking the objects that lead there covered one path at a time, and each path
// left out was the next defect. The engine asks `$B.pyobj2jsobj_hook` first
// instead, an extension point proposed upstream and vendored (see
// BRYTHON_FIX.md), so the conversion has one site and one contract.
//
// A Python list, tuple or dict is answered too, by `outbound`, the walk a named
// import's arguments take, with the memo the engine keeps for the call. The
// engine's own walk reuses the object a dict became on an earlier call, which
// misses the mutations it does not mirror, `clear()` and a nested
// `append()`; and two walks were two contracts, decided by the way a function
// was imported. The callable question comes first: a list subclass that
// defines `__call__` is a callback.
//
// Anything else goes on to the engine.
globalThis.__BRYTHON__.pyobj2jsobj_hook = (value, memo) => {
    const $B = globalThis.__BRYTHON__;

    if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return undefined;
    if (declared(value) !== null || ADAPTERS.has(value)) return pyHandler(value);
    if (!($B.is_list(value) || $B.is_tuple(value) || $B.is_dict(value))) return undefined;

    return outbound(value, memo);
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
    // never match the `on` that preceded it. The pair is what has an identity —
    // the function and its receiver — and keying on the pair is also what keeps
    // two instances of one class apart.
    //
    // A **callable instance** is neither. It is one object for its whole life,
    // and the function that performs its call is not part of who it is: keying
    // it on the pair made `Strategy.__call__ = other` hand out a *second*
    // wrapper, so the registry that had been given the first could not remove
    // it, and made `handler` and `handler.__call__` — two Python values, two
    // contracts — share whichever wrapper crossed first. Its own identity is the
    // object, and that is the key.
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
    const wrapped = pyCall(found.fn, found.where, 0, found.arity, found.named ?? undefined, (one) =>
        pyArg(inbound(one))
    );

    // An instance trims at the call, against whatever its class holds now, so its
    // wrapper announces `Infinity` and would report an arity of 0. What a library
    // reads should be what the call takes, and a snapshot of it is what a
    // JavaScript function's `length` is anyway.
    if (found.instance) identified(wrapped, wrapped.name, liveArity(value));

    // **The one function published for this callable, at every crossing.** The
    // conversion of what a JavaScript caller hands used to be a second layer,
    // added by one family of sites and not the other, so one Python callback was
    // two JavaScript functions — handed as a prop and inside a config, or to a
    // library and to a child — and a registry could not remove one through the
    // other. It is the conversion `pyCall` applies now, after trimming, so
    // identity is settled here and only here.
    cache.set(key, wrapped);
    PUBLISHED.set(wrapped, value);

    return wrapped;
}

// The Python callable each function `pyHandler` published stands for, so that
// what comes back to Python through a door that keeps values, a context, is
// the callable it handed over.
const PUBLISHED = new WeakMap();

// A receiver Brython keeps as a JavaScript primitive — a `str`, a small `int`,
// a `bool` — cannot key a WeakMap, and `"hello".upper` read twice is two method
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
// reverse: a callable becomes JavaScript-callable, and everything else becomes
// plain data: `fail(400, {"missing": True})` reaching JavaScript as an object
// it can serialise, not as a Brython dict full of symbols.
//
// `made` is the call's own memo, shared by every argument of one call. Without
// it each argument was converted on its own, so `alias(shared, shared)` handed
// JavaScript two arrays for one Python list: a function comparing its arguments
// by identity answered no, and a write to the first never reached the second.
// The same graph passed inside a *single* argument came out shared, which is
// what says this is a missing memo and not a rule.
// A callable at any depth, not only at the top of an argument: a library taking
// its callbacks in an options object is the ordinary shape, and `pyHandler`
// caches by function, so the same callback nested twice is one JavaScript
// function and stays removable.
// `None` as an argument is `undefined`, the engine's pairing, so a parameter
// with a default takes it whichever way the function was imported; inside a
// container it is `null`, which is what JSON writes for it.
//
// A list, a tuple or a dict converted is recorded in `$B.PYOBJ_MAP`, the three
// the engine records, so a library handing it back hands back the Python
// value: `back(rows) is rows`, and `restored` below reads the same map. Those
// three and nothing else: a coroutine crosses as the promise of its one run,
// and recorded, the promise handed back was the coroutine, awaited a second
// time.
const outbound = (value, made) => {
    const $B = globalThis.__BRYTHON__;

    if (value === NONE) return undefined;
    if (callable(value)) return pyHandler(value);

    const converted = plainData(value, made, pyHandler);

    if ($B.is_list(value) || $B.is_tuple(value) || $B.is_dict(value)) $B.PYOBJ_MAP.set(converted, value);

    return converted;
};

// And what comes *back*. Only the outbound half existed, and the asymmetry was
// silent for as long as nobody looked at the answer: a value returned by an
// `importjs` function arrived as a raw JavaScript one, so `cubicOut(0.5)` could
// not be rounded, formatted, or even multiplied: `x * 2` raised
// JavascriptError. The same call written `js.Math.sqrt(2)` gives a Python float,
// because Brython's own JSObject machinery converts and this proxy did not.
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
    typeof value === 'function' ? jsCall(value) : globalThis.__BRYTHON__.jsobj2pyobj(value);

// **Brython's own refusal, which this proxy was going around.**
//
// A keyword call to a JavaScript function is undecidable — `foo(y=1, x=2)` on
// `function foo(x, y)` cannot be placed, because a JavaScript function carries
// no parameter names — and Brython raises `TypeError: A Javascript function
// can't take keyword arguments` for exactly that reason, in `pyargs2jsargs`.
//
// A call through this proxy never reaches that path: the keywords arrive as one
// extra **positional** argument, an object carrying them under Brython's symbol
// `$B.KW`, and the function is
// handed it as if the author had written it. Measured: `seen(1, b=2)` gave the
// function `1` and an object. So the decision is not ours to take and was never
// open — it is Brython's, and this restores it.
//
// The helpers are the other half of the same question and the opposite answer:
// their names are ours, so `helpers.js` places them. See `KEYWORDS` there.
// **And an empty one is removed, not merely accepted.** `f(1, **{})` is a
// perfectly ordinary Python call, and Brython still sends the carrier: leaving
// it in place handed the function an extra **positional** argument, so a
// variadic one counted two where the author wrote one, and a parameter with a
// default received an internal object instead of its default.
//
// The witness that missed it is worth remembering: the test called
// `measure(width, height)`, a function that ignores a third argument all by
// itself, so the answer stayed right while the call was wrong.
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
// The binding is read afresh on every access now — a `let` in a `<script
// module>` is a *binding* and not a value — and without this a name read twice
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

    return inbound(Reflect.apply(target, self, given.map((one) => outbound(one, made))));
};

export function jsCall(value) {
    // An imported constant crosses here too, and it crosses once: `export const
    // half = 0.5` reached Python as a raw JavaScript number, where `half * 2`
    // worked and `format(half, ".2f")` answered *non-empty format string passed
    // to object.__format__*. The same 0.5 returned by an imported *function*
    // came back a float, because the call goes through `inbound`. One value, two
    // capabilities, decided by the way it entered.
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
    // The two were the same treatment written twice, and the copy carried the
    // export's label — `actions — src/app.py.save` — woven into the wrapper. A
    // label is a per-site value, so every conversion built a **new function for
    // one Python callable**: the same method returned twice was two JavaScript
    // functions, `a === b` was false for one value held twice in a list, and a
    // registry could not take back what a factory had given it.
    //
    // What is lost with the copy is that label. What replaces it is the
    // callable's own, `save() — src/app.py`, which names the function that
    // raised rather than the name it was published under — the better half of
    // the trade, and the one a traceback wants.
    //
    // `pyHandler` answers `one` itself when `declared` finds no signature, which
    // is a function JavaScript built: it crosses as data, which is to say as
    // itself.
    const wrapped = pyHandler(one);

    if (wrapped !== one) return wrapped;

    // Data, and the rule goes down with it.
    //
    // This walk used to be called without the rule, so the adaptation held at the
    // top of each container and stopped one level below a dict: `[Handler(db)]`
    // crossed as a callable and `{"handlers": [Handler(db)]}` did not, which is
    // the shape a registry actually takes — callables under a name. It read as
    // depth and it was not: a list inside a list worked, because a list carries
    // `adapt` to its children and this branch did not carry it at all.
    return plainData(one, made, pyHandler);
}

// A value a module exports. A dict of functions, which is what SvelteKit's
// `actions` is, becomes an object of *wrapped* functions, so a form action gets
// the same boundary treatment as a `load()`. Anything else is plain data.
export function pyExport(value, where, lineOffset = 0) {
    // A function published under a second name. The compiler hands the module's
    // `def`s over itself and its *values* here, and `alias = original` is a
    // value: it left untouched, so calling it gave back a coroutine object and
    // `await` on a non-thenable is the value itself — the body never ran.
    //
    // Asked as `declared`, which reads the signature Python recorded, and not as
    // `callable`: a function JavaScript built and a Python name published —
    // `accepted = query(_accepted)` in a `.remote.py` — must cross as the object
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

    // A callable inside a list is the same callable the mapping below adapts,
    // and the container it was written in cannot decide whether JavaScript can
    // call it. Measured: `[Handler(db)]` handed JavaScript an object carrying
    // the instance's fields and no call, while `{"on_save": Handler(db)}`
    // beside it handed over a function — the list kept the data and lost the
    // call, the dict kept the call and lost the data, and neither said
    // anything. A registry of handlers is written both ways.
    //
    // `adapt` is the third rule `plainData` takes and it reaches a callable at
    // any depth, so a list of lists is this same line. What a wrapper does not
    // carry is the instance's attributes: the state stays in Python, where the
    // call still reaches it, which is what a bound method crossing as a
    // function already means everywhere else in this file.
    if (Array.isArray(value)) {
        return plainData(value, undefined, pyHandler);
    }

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
    // Refusing the spelling instead was the other honest answer and it was
    // dropped for a reason worth writing down: `__all__` is *Python's*
    // declaration of what a module exports, read by `from m import *` before
    // anything of ours reads it, and refusing an accurate one because
    // JavaScript would need `$B.$call` to use one of its entries would be a
    // JavaScript limit imposed on Python.
    // Recognised by shape, the way the rest of this file recognises Brython's
    // own objects: a class carries `tp_name` and `tp_bases` beside its
    // `ob_type`, which no instance and no dict does.
    if (pyClass(value)) return value;

    // Each value for what it is, rather than the whole dict for what its
    // neighbours are. The adaptation used to be all-or-nothing — every key a
    // function, or none of them wrapped — so writing `"version": 1` beside a
    // function changed *that function's* calling contract: `pure.answer()` gave
    // a promise and `mixed.answer()` gave a raw Brython coroutine, for the same
    // `async def`.
    //
    // `define`, because the key is the author's. `{"__proto__": f}` written with
    // `=` reaches the setter: the key never became an own property, and the
    // wrapped function became the object's prototype instead. `plainData` had
    // learned that; this branch had not, and being fixed in one converter is not
    // being fixed in the export.
    // **A mapping, and not anything that happens to hold a function.** The test
    // was `pairs.some(callable)` alone, so a JavaScript instance carrying a
    // callback as a field — `this.callback = () => …`, an ordinary shape — was
    // rebuilt as an object literal and lost its prototype: `service.ping` was
    // `undefined` for the consumer, while the *same* object returned by a
    // function came back whole.
    //
    // `plainData` has had the rule for as long as it has had the comment above
    // it — *anything of a class of its own is not ours to flatten* — and this
    // branch, which is the second site that writes a mapping out, did not ask
    // it. That pair is named a few lines down for `propertyName`; this is the
    // other half of the same split.
    //
    // Decided before anything is read: an object of a class of its own is
    // handed over as it is, its accessors untouched, and a JavaScript literal
    // shows whether it holds a callable in its descriptors, so its getters run
    // once, in the walk that keeps what they give.
    const isDict = globalThis.__BRYTHON__.is_dict(value);

    if (!isDict && !plainObject(value)) return plainData(value, undefined, pyHandler);

    const holdsCallable = isDict
        ? pyEntries(value).some(([, one]) => callable(one))
        : Object.values(Object.getOwnPropertyDescriptors(value)).some(
              (one) => one.enumerable && 'value' in one && callable(one.value)
          );

    if (holdsCallable) {
        const pairs = pyEntries(value);
        const out = {};

        // A WeakMap and not a `new Set()`, which is how the other rule is asked
        // for by name: a Set here put the *JSON* policy on an export to
        // JavaScript, so a shared list came out as two lists and a write to one
        // never reached the other. Whether a neighbouring key happens to hold a
        // function decided it, for the same Python values.
        //
        // The dict itself goes in the memo, so a value that points back at it
        // meets this object rather than a second copy.
        const made = new WeakMap();

        made.set(value, out);

        for (const [key, one] of pairs) {
            define(out, propertyName(key, out), exported(one, made));
        }

        return out;
    }

    // A mapping holding no callable of its own still holds the rule, and the
    // branch above is only about *labels*: it exists to name `module.actions.save`
    // in a diagnostic, which needs the key, and a walk cannot. What it is not is
    // the place the adaptation lives — this line handed the whole dict to the
    // bare walk, so `{"handlers": [Handler(db)]}`, a registry under a name, lost
    // every call it held while `[Handler(db)]` beside it kept them. The condition
    // read the top level to decide for everything underneath.
    return plainData(value, undefined, pyHandler);
}

// A module's function, read from Python.
//
// `$B.imported` holds a plain JavaScript object, and the accessors live on its
// prototype, where a module's attribute lookup does not reach, so Brython
// reads it as a foreign object and converts the arguments on the way in. A
// `dict` would arrive with only its subscript left.
//
// Undone rather than prevented: `pyobj2jsobj` records what it converted in
// `$B.PYOBJ_MAP`, so the original is there to hand back. Anything not in it
// passes through untouched.
const boundaries = new WeakMap();

const restored = (value) => {
    if (value === null || typeof value !== 'object') return value;

    const original = globalThis.__BRYTHON__.PYOBJ_MAP?.get(value);

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

// A component's own function, as Svelte and the DOM call it.
//
// The third of the three wrappers, and the one that used to live in
// `compile.cjs` as a string. That is the dangerous kind of copy: a rule added
// here cannot reach a template literal in another file, and twice in one day it
// did not — the argument conversion arrived at `pyCall` and at `pyModule` and
// stopped at the component, where an action then took a JavaScript number.
//
// `call` is handed the arguments rather than the wrapper reading them, because
// what an expression function does with them differs — it takes its values
// already Python — and that difference is the compiler's to write.
//
// The result goes through `pyNumbers`, not `plainData`: what a component hands
// the *framework* is a transition's options or an action's teardown, and a
// Brython float there is an object `Element.animate` refuses. A coroutine is
// fired and not awaited, since nobody reads what a handler returns.
// `convert` null is for a value that goes back into Python rather than out to
// the framework, and is handed back as it is: made a JavaScript number, a float
// would come back to Python a `JSObject`.
const running = (call, where, lineOffset, convert = pyNumbers) => {
    try {
        const result = call();
        const value = schedule(result, where, lineOffset, convert ?? undefined);

        // A coroutine's promise converts what it resolves to, above; the
        // promise itself is handed back as it is.
        return convert === null || value !== result ? value : convert(value);
    } catch (error) {
        throw pyError(error, where, lineOffset);
    }
};

// The arity is read at the call, from the value the name holds then, for the
// reason `pyDef` is written: `@export` above another decorator publishes a name
// whose value is no longer the `def`, and the compiler's count came off the
// `def`'s own AST. A `@collect` answering a `*values` function had three
// arguments in Python and one through its export.
//
// The call goes through what `declared` hands back rather than through the name
// directly, which is the other half: a decorator that answers a **callable
// instance** is called perfectly well by Python and is not a JavaScript
// function, and the emitted call used to be a JavaScript call.
//
// What stays different from `pyDef` is the result: a component hands the
// *framework* a transition's options or an action's teardown, so `pyNumbers`
// and not `plainData`. That difference is why this wrapper exists at all. A
// callable returned whole is a callback like one returned inside a config.
const returned = (value) => (callable(value) ? pyHandler(value) : pyNumbers(value));

export const pyComponent = (read, where, lineOffset) => {
    const first = declared(read());

    return identified(
        (...args) => {
            const value = read();
            const found = declared(value);
            const given = taken(args, found === null ? Infinity : found.arity);

            return running(
                () => (found === null ? value(...given) : found.fn(...given)),
                where,
                lineOffset,
                returned
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

export function storeMember(value, where, lineOffset, call) {
    if (declared(value) === null) return plainScalar(value);
    if (call !== undefined) return call;

    let wrapped = STORE_CALLS.get(value);
    if (wrapped === undefined) STORE_CALLS.set(value, (wrapped = pyComponent(() => value, where, lineOffset)));

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

export const pyExpression = (call, where, lineOffset, arity, kept = false) =>
    identified(
        (...args) =>
            running(
                () => call(args.slice(0, arity).map(pyBind)),
                where,
                lineOffset,
                kept === true ? null : (COMPARED[kept] ?? pyNumbers)
            ),
        nameOf(where),
        arity
    );

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

// Svelte's `safe_not_equal`, asked of what the value is to JavaScript: a Python
// float is an object, and would always count as changed where the number it
// stands for does not. A container still always counts, as an object does.
const changed = (before, after) => {
    const a = before === NONE ? undefined : (pyScalar(before) ?? before);
    const b = after === NONE ? undefined : (pyScalar(after) ?? after);

    // eslint-disable-next-line no-self-compare
    return a != a ? b == b : a !== b || (a !== null && typeof a === 'object') || typeof a === 'function';
};

// What an action hands back keeps the shape Svelte reads, and its `update` is
// given the value alone: Svelte passes the whole payload again, and the payload
// is a new array on every run, so Svelte's own comparison always answers yes.
// It is made here instead, on the value, and an action written without one is
// never updated. Both are called on the result, as Svelte calls them, so a
// method reading `this` finds it. A function is a result like an object, since
// Svelte reads the two methods off whatever it is handed.
const actionPayload = (python, result, given) => {
    if (result === null || (typeof result !== 'object' && typeof result !== 'function')) return result;

    let held = given[0];

    return {
        update:
            typeof result.update === 'function'
                ? ([, , ...next]) => {
                      if (!given.length || !changed(held, next[0])) return;

                      held = next[0];
                      result.update(python ? held : forJavaScript([held])[0]);
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

// `animate:`, called `(node, { from, to }, payload)`.
export function directiveAnimate(node, rects, [where, head, ...value]) {
    return directiveCall(where, head(), [node, rects, ...value]).result;
}

// What a directive hands back, read by Svelte: an action's `update` and
// `destroy`, a transition's `duration` and `tick`. A dict holds them as entries
// and `pyNumbers` adapts those. An **instance** holds them as methods of its
// class, which no walk of its own properties finds, so `return Lease(node,
// value)` mounted and then never updated nor cleaned up. Its view reads each
// name through the attribute protocol when Svelte asks, and answers `undefined`
// for one it does not have, which is how Svelte asks whether there is one.
//
// A **Python callable** handed back is a deferred transition: Svelte calls it
// later for the config. It is wrapped like the directive's own callee, so its
// arguments are converted and its config comes back through this same rule. A
// callable instance is asked first, before it is taken for a config object.
function directiveResult(value, where) {
    if (declared(value) !== null) return directiveCallable(value, `${where} result`);

    const instance =
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        pyClass(value.ob_type) &&
        pyScalar(value) === undefined &&
        !globalThis.__BRYTHON__.is_dict(value);

    if (!instance) return pyNumbers(value);

    return new Proxy(
        {},
        {
            get(_, key) {
                if (typeof key === 'symbol') return undefined;

                const found = globalThis.__BRYTHON__.$getattr(value, key, MISSING);

                if (found === MISSING || found === NONE) return undefined;

                return callable(found) ? pyHandler(found) : pyNumbers(found);
            }
        }
    );
}

// Callable in Python, which is the question every boundary that promises to
// adapt a callback asks, and the one this site was still answering with
// `typeof`. A module publishing `fade = Fades(0.3).run` — an object configured
// once, its method named by the directive — handed Svelte a value it cannot
// call, and so did a callable instance and a classmethod, for a body that
// worked the moment it was written as a `def`.
function directiveCallable(member, path) {
    const found = declared(member);

    if (found === null && typeof member !== 'function') return member;

    let wrapped = directives.get(member);

    if (wrapped === undefined) {
        // Trimmed to the arity Python declared, exactly as a handler is: Svelte
        // calls a transition `fn(node, params, options)`, and `def
        // typewriter(node, params)` refuses the third.
        //
        // `declared` reads the receiver, the signature through `$js_func`, and
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
                running(() => called(...taken(args, arity)), where, undefined, (value) => directiveResult(value, where)),
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

export function readAttr(target, name) {
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
        !pyClass(target.ob_type) &&
        !$B.is_dict(target)
    ) {
        if (name in target) return $B.jsobj2pyobj(target[name], target);

        $B.RAISE(_b_.AttributeError, `'${name}'`);
    }

    // A function a module's namespace exports, `importjs * as callbacks`, is the
    // function the same import by name gives: `jsCall`'s adapter, which hands
    // the call the receiver it is called with. Read as the engine reads any
    // object's member, it was bound to the namespace, so `onclick={callbacks.
    // receiver}` was called with the namespace where Svelte hands the element.
    if (moduleNamespace(target) && typeof target[name] === 'function') return jsCall(target[name]);

    // With a default, so a miss costs no exception: building one on every field
    // read of every dict would be the whole cost of this feature.
    const found = $B.$getattr(target, name, MISSING);
    if (found !== MISSING) return found;

    const item = lookup(target, name);
    if (item !== MISSING) return item;

    // No such key either: the real lookup raises.
    return $B.$getattr(target, name);
}

// Builtin sequences, whose `__getitem__` refuses a string key with a TypeError:
// for them that says "no such key", as a KeyError says it for a mapping.
const SEQUENCES = [_b_.list, _b_.tuple, _b_.str, _b_.bytes, _b_.range];

// The key `name` of `target`, or MISSING when there is none. An absence is what
// the protocol answers when nothing is there: no `__getitem__` at all, a
// `LookupError`, or a builtin sequence refusing a string. Anything else a
// `__getitem__` raises is its author's answer and goes on, both to a read and
// to the choice of where a write lands.
function lookup(target, name) {
    const $B = globalThis.__BRYTHON__;

    let cls;
    try {
        cls = $B.get_class(target);
        if ($B.$getattr(cls, '__getitem__', MISSING) === MISSING) return MISSING;
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
        if (mro.includes(_b_.TypeError) && SEQUENCES.includes(cls)) return MISSING;

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
    return typeof value === 'number' ? globalThis.__BRYTHON__.jsobj2pyobj(value) : value;
};

// Whether a read through the dot would find an attribute, answered without
// reading it: a write that asked `$getattr` ran the getter of the property it was
// about to set, so a getter that counts or refuses saw a read the assignment
// never makes, and the setter was not reached when the getter raised. The class
// dictionaries and the instance's own say where an attribute lives, and they
// are asked first, whatever protocol the class adds. Only a name found in
// neither, on a foreign object or a class with its own `__getattr__` or
// `__getattribute__`, is left to the protocol, the one thing that can answer
// for an attribute nothing declares.
function attributed(target, name) {
    const $B = globalThis.__BRYTHON__;
    const type = pyType(target);

    if (type === undefined) return $B.$getattr(target, name, MISSING) !== MISSING;
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
// The element's `type` is read off the node. Its value cannot be: a DOM value is
// text, so `value={1}` reads back as "1", and the group wrote that string into
// the author's data — an initial number matched nothing, and a checkbox left
// `[1, '1']` behind, the same choice under two types.
//
// The typed value is nowhere on the node either. Svelte keeps it on the hidden
// `__value` property only for an element it sees a group binding on, and this one
// carries an action instead. So the markup pass reads the tag's own `value` and
// passes it here. It is absent when the tag has no braced value, and then the
// node's text is exactly right: that is what a plain HTML form hands over.
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

export function group(node, [current, write, chosen, binding, scope, where = []]) {
    const boxes = node.type === 'checkbox';
    const token = groupToken(scope, binding);

    node.$svelthonGroup = targetOf(token, where);

    // `undefined` now means one thing only: the tag's value is static text, so
    // the node holds it and nothing can move it. Everything an author wrote as
    // an expression — braced, quoted, or quoted around text — is compiled and
    // handed over, because the node's text is not the value (`value="{n}"` binds
    // a number) and because reading it here is not ordered against Svelte
    // writing it.
    let picked = chosen;

    const value = () => (picked === undefined ? node.value : pyBind(picked));

    // **A checkbox group is the checked inputs, read in the order they sit in
    // the document.** Svelte's own binding does exactly that —
    // `get_binding_group_value` walks the group's inputs — and this built the
    // list from the click history instead: the value clicked last went to the
    // end, so ticking `b` then `a` gave `['b', 'a']` where Svelte gives
    // `['a', 'b']`. The selection was right and its order was ours.
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
    // Collecting on the token alone gathered the whole loop, so ticking a box
    // on the second row wrote the first row's selection into it as well — a
    // form recording choices the reader never made for that item.
    //
    // Membership is the registration, which `destroy` removes, and not being in
    // the document: a control taken out of the page by a script, or a component
    // mounted in a detached target, is still mounted, and Svelte's own group
    // keeps it until its teardown. Filtering on `isConnected` dropped a ticked
    // box from the selection the moment it left the page. An input that
    // registered after the last sort is at the end until the next one runs.
    const inOrder = () => inputs.filter((one) => sameTarget(one.$svelthonGroup, node.$svelthonGroup));

    // Python's `==`, not JavaScript's `===`. A Brython float is an object
    // `{ob_type, value}`, so `value={0.5}` evaluated twice is two objects and
    // identity answers false for what the author wrote as one value. `==` and
    // `in` are also what a Python author reads in a group.
    // Python's comparison, read as Python reads it. Asking `=== true` of the
    // answer is a narrower question than the one that was asked: `__eq__` may
    // return anything, and `return int(self.n == other.n)` gives 1 — true to
    // Python, and not the JavaScript boolean. A choice already present in the
    // state then showed as unselected.
    const alike = (one, mine) => {
        try {
            return __pybridge.truthy(globalThis.__BRYTHON__.rich_comp('__eq__', one, mine));
        } catch (error) {
            // An `__eq__` of the author's that raises is not a "no". The fall
            // back to identity is for a value Python cannot compare at all — a
            // foreign JavaScript one — and using it for a failed protocol
            // answered *plausibly and wrongly*: two distinct instances, so the
            // control showed nothing selected while the model had not managed to
            // compare anything. Same rule as `__pybridge.truthy` one file up.
            if (raised(error)) throw pyError(error, `bind:group={${binding}}`);

            return one === mine;
        }
    };

    const same = (one) => alike(one, value());

    // **A value goes into a group's list once.** Two controls may stand for one
    // choice — a form showing the same option in two sections — and Python
    // equality is what says they are one choice, since two Brython values that
    // are equal are rarely the same object.
    const include = (into, held) => {
        if (!into.some((already) => alike(already, held))) into.push(held);
    };

    const show = (held) => {
        node.checked = boxes ? Array.from(held ?? []).some(same) : same(held);
    };

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
    // showing the model first erased the click. A fresh mount makes the two
    // agree, so it shows the model as before.
    if (node.defaultChecked === node.checked) show(current);
    else queueMicrotask(() => (boxes || node.checked) && changed());

    return {
        update([next, , given, , , moved = []]) {
            node.$svelthonGroup = targetOf(token, moved);
            picked = given;
            show(next);
        },
        destroy() {
            node.removeEventListener('change', changed);
            RESETS.delete(node);

            const at = inputs.indexOf(node);
            if (at !== -1) inputs.splice(at, 1);
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
// silently unhooking the signal after the very first write, which is why
// `count = count + 1` stopped propagating while `count += 1` still worked.
// `delete` ignores inherited properties; assignment still runs the inherited
// setter.
//
// `source` reads what the name holds as stored, with no conversion and no
// computation, where `get` does either: a prop's number made a float, a
// derived's body run. It is what `del` watches; without one, `get` is it.
const STORED = new WeakMap();

export function bind(proto, key, get, set, source) {
    if (source !== undefined) {
        let sources = STORED.get(proto);
        if (sources === undefined) STORED.set(proto, (sources = new Map()));
        sources.set(key, source);
    }

    Object.defineProperty(proto, key, {
        get,
        // No setter means the name is a *default*: an injected helper, or a
        // JavaScript name published for Python to read. The author may still
        // take that word, and until this existed their write was swallowed.
        //
        // Brython writes a global as a plain property assignment on the
        // namespace, so it walked the prototype chain, found `() => {}` and went
        // nowhere. `class date: …` left no class behind, and reading `date` gave
        // the helper for the rest of the module.
        //
        // Writing an own property on the receiver is what a prototype is for:
        // the default answers until someone assigns, and then theirs shadows it.
        // Not an arrow, because `this` has to be the namespace being written to.
        set:
            set ??
            function (value) {
                Object.defineProperty(this, key, {
                    value,
                    writable: true,
                    enumerable: true,
                    configurable: true
                });
            },
        enumerable: true,
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

export const unproxied = (value) =>
    (value !== null && typeof value === 'object' && WRITTEN.get(value)) || value;

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

        if (accessor?.get === undefined || namespace[name] === undefined) {
            return deleteName.call(this, name, locals, inum);
        }

        accessor.set?.call(namespace, undefined);

        // What the name still holds once deleted, read at its source: nothing,
        // or the value a parent passes a prop, which the child does not own.
        const source = STORED.get(proto)?.get(name) ?? accessor.get;
        const left = source.call(namespace);
        const restore = (target) => {
            Object.defineProperty(proto, name, accessor);
            DELETED.get(target)?.delete(name);
        };

        // Absent to Python, still read by the page: the source is a signal,
        // which keeps the page subscribed, and the getter hands back
        // `undefined`, which a `$proxy` namespace reads as no name at all. Any
        // write puts the published accessor back: through the namespace, by
        // `=`, a loop, an import or a store's setter; or from outside it, a
        // parent passing a prop a new value, which the source shows.
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
            enumerable: false,
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

