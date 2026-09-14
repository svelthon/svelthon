// What every compiled component imports. `globals.js` prepares the scope
// brython.js reads as it loads, and `boot.js` imports the engine itself and
// starts it.
import './globals.js';
import './boot.js';
import { createSubscriber } from 'svelte/reactivity';

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
export const __pybridge = {
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
        } catch {
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
        if (Array.isArray(value)) {
            // Hand the watch down to the rows: {#each} walks the array in
            // JavaScript, never through $getitem, so this is the only path by
            // which an item can come under watch before its block reads it.
            if (MARKS.has(value)) {
                for (const item of value) inherit(value, item);
            }

            return value;
        }
        if (value === undefined || value === null) return [];

        try {
            return _b_.list.$factory(value);
        } catch (error) {
            // A foreign JavaScript iterable, a NodeList from bind:this, is not
            // Python's to convert, but Svelte can still walk it.
            if (value && typeof value[Symbol.iterator] === 'function') return value;
            throw error;
        }
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
    bound(value) {
        return value === NONE ? undefined : value;
    },

    // `{...attrs}`: Svelte diffs the spread object against the one from the
    // previous render, and a dict mutated in place *is* the same object. In
    // JavaScript the problem does not arise: spreading a $state proxy produces a
    // fresh object on every evaluation. So a shallow copy is returned, and a
    // Python spread renders exactly like its JavaScript counterpart.
    spread(value) {
        if (value === null || value === undefined || typeof value !== 'object') return value;
        return { ...value };
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
        if (MUTATORS.has(attr)) {
            // A container handed to a mutator is now inside a watched one, so
            // it comes under the same watch. This is the other half of the walk
            // `mark` does: that one takes what was already there, this one
            // takes what arrives afterwards.
            for (const arg of args) inherit(obj, arg);
            if (attr === 'setdefault') inherit(obj, result);
            MARKS.get(obj)();
        } else if (VIEWS.has(attr)) {
            // `.items()` and `.values()` hand out the children without ever
            // indexing them. A Brython dict exposes its keys as enumerable
            // JavaScript properties, so the values are reachable directly, no
            // need to materialise the view to hand them the watch.
            for (const key in obj) inherit(obj, obj[key]);
        } else {
            inherit(obj, result); // `get`
        }
    };

    // Rest arguments rather than `arguments` + apply: these sit on the hottest
    // path Brython has, and the old form blocks V8's optimiser.
    const callAttr = $B.call_attr;
    $B.call_attr = function (obj, attr, ...rest) {
        const result = callAttr(obj, attr, ...rest);

        // The marker is checked first on purpose: this runs on every method
        // call in the program, and an unwatched object must pay one property
        // miss, not a set lookup.
        if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) {
            // `call_attr` takes the position marker before the arguments, and
            // it is the arguments that come under watch.
            if (FOLLOWED.has(attr)) afterCall(obj, attr, result, rest.slice(1));
        }

        return result;
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
            const result = method(...args);
            afterCall(obj, attr, result, args);
            return result;
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

        if (
            obj !== null &&
            typeof obj === 'object' &&
            MARKS.has(obj) &&
            FOLLOWED.has(attr) &&
            typeof result === 'function'
        ) {
            return notifying(obj, attr, result);
        }

        return result;
    };

    const setitem = $B.$setitem;
    $B.$setitem = function (obj, key, value, ...rest) {
        const result = setitem(obj, key, value, ...rest);
        if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) {
            inherit(obj, value); // `d["rows"] = rows` puts rows under watch too
            MARKS.get(obj)();
        }
        return result;
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
            if (obj !== null && typeof obj === 'object' && MARKS.has(obj)) {
                inherit(obj, value); // an attribute holding a container is watched too
                MARKS.get(obj)();
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
        const result = augmAssign(left, op, right, ...rest);

        if (
            result === left &&
            left !== null &&
            typeof left === 'object' &&
            MARKS.has(left)
        ) {
            inherit(left, right); // `rows += [[]]` puts the new rows under watch
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

// Attach a marker to the value stored under a module-level name: `bump` says it
// moved, `read` subscribes whoever is asking to the signal that says so. One
// object may be bound to two names; both are then told, and both watched.
//
// The pair is what makes the reactivity a property of the *object* rather than
// of the place it was declared: duck typing, applied to change notification.
// Anything holding the value can subscribe to it just by handing it through.
// Brython keeps an instance's attributes under a private symbol, not as JS
// properties, so they have to be found once, from the first object carrying it.
let DICT;

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

function ownAttributes(value) {
    if (Array.isArray(value)) return undefined;

    if (DICT === undefined) {
        DICT = Object.getOwnPropertySymbols(value).find((symbol) => symbol.description === 'DICT');
        if (DICT === undefined) return undefined;
    }

    return value[DICT];
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

const upwards = (marker, stamp, key) => {
    if (marker.seen === stamp) return;
    marker.seen = stamp;

    for (const one of marker[key]) one();

    if (marker.parents !== undefined) {
        for (const parent of marker.parents) upwards(parent, stamp, key);
    }
};

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

function mark(value) {
    const marker = () => upwards(marker, ++walked, 'bumps');

    marker.bumps = [];
    marker.reads = [];
    marker.follow = () => upwards(marker, ++walked, 'reads');

    MARKS.set(value, marker);

    // Everything already inside the value when the watch begins: an attribute
    // written in __init__, an element of a list, a value of a dict. All of them
    // were put there before the object came under watch, so nothing has handed
    // them anything. inherit() marks in turn, so depth follows on its own, and
    // a cycle stops at the first object that already carries a marker.
    //
    // This is the moment the whole graph is in hand, and taking it here is what
    // lets every way of reading a child go unwatched: the child is marked
    // before Python can reach for it, by any route.
    const attributes = ownAttributes(value);
    if (attributes !== undefined) {
        for (const key in attributes) inherit(value, attributes[key]);
    }

    // Only what Python calls a container, and that bound is the whole point:
    // walking any object's keys let the watch leave the author's data. Measured,
    // it reached `__BRYTHON__` itself, 558 keys, and from there `localStorage`.
    // A list holds its elements as an array, a dict holds its items as
    // enumerable properties, and nothing else here holds Python containers: a
    // set cannot, since a list is not hashable.
    if (Array.isArray(value)) {
        for (const child of value) inherit(value, child);
    } else if (globalThis.__BRYTHON__.get_class(value) === _b_.dict) {
        for (const key in value) inherit(value, value[key]);
    }

    return marker;
}

// Sign one subscriber onto one marker, and tell `owner` about it so the same
// subscriber can sign off. `owner` is the component's list; a store has none,
// since its subscription lives as long as the module does.
const join = (marker, bump, read, owner) => {
    if (marker.bumps.includes(bump)) return;

    marker.bumps.push(bump);
    marker.reads.push(read);

    if (owner !== undefined) owner.push(marker, bump);
};

export function track(value, bump, read, owner) {
    if (value === null || typeof value !== 'object') return value;

    // Cheapest path first: a value already watched is the common case, and it
    // must not pay a type classification on every write.
    const own = MARKS.get(value);
    if (own !== undefined) {
        join(own, bump, read, owner);
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
function inherit(parent, child) {
    if (child === null || typeof child !== 'object') return child;

    let own = MARKS.get(child);

    if (own === undefined) {
        if (!mutable(child)) return child;
        own = mark(child);

        // A frozen object refuses the marker, and `mark` says so by giving the
        // value back unchanged.
        if (own === undefined) return child;
    }

    // One line up, not a copy of everyone above. A child under two parents keeps
    // both, and a mutation reaches the readers of either.
    const marker = MARKS.get(parent);

    if (own.parents === undefined) own.parents = [marker];
    else if (!own.parents.includes(marker)) own.parents.push(marker);

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

    // The deepest frame is where it actually broke. Line numbers count from the
    // start of the Python source, which for a component begins after its opening
    // <script> tag, hence the offset back to the file's own numbering.
    let line;
    try {
        let tb = $B.$getattr(error, '__traceback__');
        while (tb && tb !== NONE) {
            line = $B.$getattr(tb, 'tb_lineno');
            tb = $B.$getattr(tb, 'tb_next');
        }
    } catch {
        /* no usable traceback */
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

// A promise that can tell it is being waited for.
//
// `await p` on a plain promise never reads `p.then`: the language recognises
// its own kind and goes to the internal machinery instead. A subclass is not
// that kind, so `await` takes the long way and calls `then` like anyone else,
// which is how `schedule` below knows the failure reached somebody. Everything
// that asks stays satisfied: it is still an instance of Promise.
class Waited extends Promise {}

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

    // What the caller gets back is a promise, so an `async def` can be awaited
    // by whoever called it, `{#await greet()}` in a template above all, which
    // received `undefined` for as long as this returned nothing.
    //
    // run(coro, onsuccess, onerror). Its default onerror only logs, so an
    // exception raised inside a coroutine reaches nothing at all: no error
    // event, no overlay.
    let watched = false;

    const promise = new Waited((resolve, reject) => {
        $B.$getattr(aio, 'run')(
            result,
            (value) => {
                $B.leave_frame(); // what Brython's own default does
                resolve(value);
            },
            (error) => {
                const failure = pyError(error, where, lineOffset);
                reject(failure);

                // An event handler's return value is dropped on the floor, so
                // nobody is there to catch this one. Rethrowing from a timeout
                // turns it into a genuine uncaught error, the way the
                // synchronous path already behaves, but only when the caller
                // really did ignore the promise, or a template that awaits and
                // renders `{:catch}` would report the failure twice.
                setTimeout(() => {
                    if (!watched) throw failure;
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

// Which file claimed each Python module name. On a global registry for the same
// reason the plugin's is: the preprocessor and the page are not always the same
// module instance.
const registered = (globalThis[Symbol.for('svelthon.modules')] ??= new Map());

// A key written, and not assigned. `out[key] = value` runs the setter that
// `__proto__` has on `Object.prototype`, so a dict holding that key lost it and
// handed back an object whose prototype was whatever the key held:
// `{"__proto__": {"flag": 42}}` crossed as `{}` answering 42 for `flag`. A key
// is data here, wherever it came from.
const define = (target, key, value) =>
    Object.defineProperty(target, key, {
        value,
        enumerable: true,
        writable: true,
        configurable: true
    });

// What an exported function hands back to the framework.
//
// SvelteKit serialises whatever `load()` returns, and a Brython dict carries
// symbol-keyed internals (`Symbol(OB_TYPE)`) that its serialiser refuses
// outright. So the boundary converts: Python containers become plain JavaScript
// data, which is the only shape anything outside Python can read anyway.
export function plainData(value, seen) {
    if (value === undefined || value === null || value === NONE) return null;
    if (typeof value !== 'object') return value;

    // A Brython float is an object holding a number and a reference to its
    // type. `tojson(1 / 3)` walks the lot: 20 KB of `ob_type`.
    if (value.ob_type === _b_.float) return value.value;

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

    // Anything of a class of its own is not ours to flatten: a Response, a URL,
    // a Date, a Map, a Promise: a Python `load()` may hand any of those straight
    // back to the framework, and copying their keys would destroy them.
    //
    // Read on the prototype and not as `value.constructor`, which a dict may
    // carry as data: `{"constructor": "invoice"}` answered a constructor of its
    // own and the whole mapping crossed unconverted, floats and all. A Brython
    // dict and a plain object both sit on `Object.prototype`.
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return value;

    // A class instance keeps its attributes under a private symbol rather than as
    // JavaScript properties, so walking its own keys finds almost nothing and
    // wanders into the class object instead. Its `__dict__` is what a reader
    // wants, and it is what JavaScript itself would serialise from a class
    // instance: the fields, not the getters on the prototype.
    const attributes = ownAttributes(value);

    if (attributes !== undefined && attributes !== null && typeof attributes === 'object') {
        const fields = {};
        for (const key of Object.keys(attributes)) define(fields, key, plainData(attributes[key], seen));
        return fields;
    }

    // Own string keys only, and never a class lookup: `get_class` probes the
    // object's symbols, and SvelteKit wraps `event.params` in a proxy that
    // records every key read, including the symbols we would have introduced,
    // which its serialiser then refuses. A Brython dict exposes its keys as
    // ordinary properties, so this reads both sides of the bridge.
    //
    // A set has no key to copy: `list(mon_set)` is the Python way to hand one
    // over, and it is what any serialiser would want anyway.
    const out = {};
    for (const key of Object.keys(value)) define(out, key, plainData(value[key], seen));
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
// Duck-typed, and the identity for anything else: a module called from
// ordinary JavaScript keeps its arguments untouched.
function pyDict(entries) {
    const $B = globalThis.__BRYTHON__;
    const out = _b_.dict.$factory();

    for (const [key, value] of entries) $B.$setitem(out, key, value);
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
export function pyData(value) {
    const $B = globalThis.__BRYTHON__;

    if (value === undefined || value === null) return NONE;

    // A whole number past 2^53 is a Python `int` and a JavaScript `bigint`, and
    // the early return below would hand back the double instead: `to_py(1e21)`
    // answered an int whose `repr` was `1e+21`, and `to_py(2 ** 70)` one whose
    // digits were wrong. Inside a container the same number came back exact,
    // because the walk crosses `jsobj2pyobj` and this line did not. Same value,
    // two answers, decided by depth.
    if (typeof value !== 'object') return value;
    if (Array.isArray(value)) return _b_.list.$factory(value.map(pyData));

    const python = $B.jsobj2pyobj(value);

    // Idempotent, which it has to be: `jsobj2pyobj` hands back the *original*
    // Python object when the value once came from one, which is what the
    // `PYOBJ` WeakMap is for, and a dict has no `to_dict`. Asking for it
    // unconditionally made `to_py` raise on every value that did not need
    // converting, so it was no use as the guard on a boundary, which is the one
    // place anyone would reach for it.
    const toDict = $B.$getattr(python, 'to_dict', null);

    return toDict === null ? python : toDict();
}

export function pyArg(value) {
    if (value === null || typeof value !== 'object') return value;
    if (!value.params || !value.url || !value.request) return value;

    // Reading the framework's own searchParams is what registers the dependency,
    // so it is tried first, but it throws while prerendering, where a query
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
        // The event itself, for whatever the snapshot does not cover: cookies,
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
    if (value === null || typeof value !== 'object') return value;
    if (value.ob_type === _b_.float) return value.value;

    let out = value;

    for (const key of Object.keys(value)) {
        const one = value[key];
        let replacement;

        if (one !== null && typeof one === 'object' && one.ob_type === _b_.float) {
            replacement = one.value;
        } else if (typeof one === 'function') {
            // A callback the framework keeps and calls itself, a transition's
            // `tick(t, u)`. It never crosses a wrapper, so its arguments arrive
            // as raw JavaScript numbers, and Brython reads a number as an int.
            // So `tick(0, 1)` works, since 0 and 1 *are* integers, and the first
            // frame after it raises `0.0026 can't be converted to BigInt`,
            // which is what a transition that plays once and then stops is.
            replacement = (...args) => one(...args.map(inbound));
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
// Seven functions below carry a value between Python and JavaScript, and each
// applies some part of the same five treatments. Every choice is argued beside
// the function it belongs to, and that is the right place for a *reason*; it is
// the wrong place for a *comparison*, because the choices are not independent.
// Whether a `load()` converts its result and a DOM handler does not is one
// decision taken seven times, and nobody could see it without this table.
//
//                | arity | args in  | coroutine | result out | memoised |
//   pyCall       |  yes  | pyArg    | awaited   | plainData  |          |
//   pyHandler    |  yes  | pyCall, with the arity read off the signature  |
//   pyEvent      |  yes  | pyArg    | fired     |            |          |
//   pyBoundary   |  (a)  | restored |           |            |   yes    |
//   pyModule     |  yes  |          |           | pyNumbers  |   yes    |
//   pyExport     |       |          |   (b)     | plainData  |   yes    |
//   jsCall       |       | outbound |           | inbound    |          |
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

function pyCall(fn, where, lineOffset = 0, arity = Infinity) {
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
function declared(value) {
    if (typeof value !== 'function') return null;

    const fn = typeof value.$js_func === 'function' ? value.$js_func : value;
    const infos = fn.$function_infos;

    // `arity` is what the whole thing is for, so a shape that has no number
    // there is not a Python signature, whatever else it carries.
    if (!Array.isArray(infos) || (!infos[8] && typeof infos[10] !== 'number')) return null;

    return { fn, where: `${infos[2]}() — ${infos[3]}`, arity: infos[8] ? Infinity : infos[10] };
}

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
            return schedule(called(...args.slice(0, arity).map(pyArg)), where, lineOffset);
        } catch (error) {
            throw pyError(error, where, lineOffset);
        }
    };
}

export function pyHandler(value) {
    const found = declared(value);
    if (found === null) return value;

    return pyCall(found.fn, found.where, 0, found.arity);
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
const outbound = (value) => (typeof value === 'function' ? pyHandler(value) : plainData(value));

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
// A function is the exception, and it goes past untouched. `jsobj2pyobj` builds
// a Python-callable one around it, which is a different object: what a library
// marks, a framework no longer recognises. SvelteKit's `query()` returns a
// function carrying `__.type`, and `accepted = query(_accepted)` in a
// `.remote.py` must export the object SvelteKit built. Brython calls a plain
// JavaScript function perfectly well.
const inbound = (value) =>
    typeof value === 'function' ? value : globalThis.__BRYTHON__.jsobj2pyobj(value);

export function jsCall(value) {
    if (typeof value !== 'function') return value;

    return new Proxy(value, {
        apply: (target, self, args) => inbound(Reflect.apply(target, self, args.map(outbound)))
    });
}

// A value a module exports. A dict of functions, which is what SvelteKit's
// `actions` is, becomes an object of *wrapped* functions, so a form action gets
// the same boundary treatment as a `load()`. Anything else is plain data.
export function pyExport(value, where, lineOffset = 0) {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) return plainData(value);

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

    const keys = Object.keys(value);

    if (keys.length && keys.every((key) => typeof value[key] === 'function')) {
        const out = {};
        for (const key of keys) out[key] = pyCall(value[key], `${where}.${key}`, lineOffset);
        return out;
    }

    return plainData(value);
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

// A Python module under a JavaScript name, for the one place that needs one:
// what a directive *names*. Svelte copies that text into a `() => …` of its own,
// so `in:fades.typewriter` compiles to `() => fades.typewriter` and looks for a
// JavaScript `fades`, which an `import fades` never made, since it binds in
// Python's namespace.
//
// Members are wrapped the way a component's own functions are, not the way the
// module's exports are: measured, the export path runs `plainData` over the
// result, and a transition's `tick(0.5, 0.5)` then raises `0.5 cannot be
// converted to a BigInt` on the first fractional frame. `pyNumbers` is what
// repairs exactly that, and it is what a `def` written in the component already
// goes through.
//
// Read lazily, so the module only has to exist by the time the directive runs,
// and memoised per function, so two reads of the same name answer the same
// object: Svelte keeps what a directive gave it.
const directives = new WeakMap();

export function pyModule(name) {
    return new Proxy(
        {},
        {
            get(_, key) {
                const namespace = globalThis.__BRYTHON__.imported[name];
                const member = namespace === undefined ? undefined : namespace[key];

                if (typeof member !== 'function') return member;

                let wrapped = directives.get(member);

                if (wrapped === undefined) {
                    // Trimmed to the arity Python declared, exactly as a
                    // handler is: Svelte calls a transition `fn(node, params,
                    // options)`, and `def typewriter(node, params)` refuses the
                    // third. A `def` written in the component is trimmed by its
                    // own wrapper, which is why it worked and this did not.
                    const infos = member.$function_infos;
                    const arity = Array.isArray(infos) ? (infos[8] ? Infinity : infos[10]) : Infinity;
                    const where = Array.isArray(infos) ? `${infos[2]}() — ${infos[3]}` : `${name}.${key}()`;

                    wrapped = (...args) => {
                        try {
                            return pyNumbers(member(...args.slice(0, arity)));
                        } catch (error) {
                            throw pyError(error, where);
                        }
                    };

                    directives.set(member, wrapped);
                }

                return wrapped;
            }
        }
    );
}

// A store's namespace, published under its Python module name, so a component's
// own Python can `import counter_store` and reach the very same signals the
// template reads. Without it the bridge would only run one way.
export function registerModule(name, namespace, source) {
    const $B = globalThis.__BRYTHON__;
    const first = registered.get(name);

    // Python imports a module by its name, and a file's name is its stem, so
    // `a/config.py` and `b/config.py` are both `config`. `$B.imported` holds one
    // entry per name, so the second silently replaced the first and every
    // `import config` anywhere read whichever loaded last.
    //
    // Refused rather than made unique. A directory-aware name would have to be
    // one Python can write, and `import config` cannot say which directory it
    // means; a refusal costs a rename and says which two files.
    if (first !== undefined && first !== source) {
        throw new SyntaxError(
            `svelthon — \`${source}\` and \`${first}\` are both imported as \`${name}\`, ` +
                `so one would silently replace the other. Rename one of them: a module's ` +
                `Python name is its file name, and \`import ${name}\` cannot say which ` +
                `directory it means.`
        );
    }

    registered.set(name, source);
    namespace.__name__ = name;

    $B.imported[name] = namespace;
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

    $B.namespace = (requested) => (requested === name ? namespace : original(requested));

    try {
        return run();
    } finally {
        $B.namespace = original;
    }
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
// The swap is what keeps this free. Brython's generated code reads
// `$B.$getattr_pep657` off the object at every call, so replacing it for the
// length of one expression costs two property writes and leaves every attribute
// access in the rest of the program untouched. Same technique as
// `withNamespace` above.
const MISSING = Symbol('svelthon.missing');

export function inTemplate(run) {
    const $B = globalThis.__BRYTHON__;
    const original = $B.$getattr_pep657;
    const originalSet = $B.$setattr1;

    $B.$getattr_pep657 = (obj, attr, inum) => {
        // With a default, so a miss costs no exception: building one on every
        // field read of every dict would be the whole cost of this feature.
        const found = $B.$getattr(obj, attr, MISSING);
        if (found !== MISSING) return found;

        try {
            return $B.$getitem(obj, attr);
        } catch {
            /* no such key either: let the real lookup raise, with its position */
        }

        return original(obj, attr, inum);
    };

    // `bind:value={row.label}` writes where the same dot read from. Without
    // this the read finds the key and the write sets a JavaScript property on
    // the dict: no error, no effect, and the field snaps back on the next
    // render. Only where the read already succeeded: an *existing* key. What a
    // missing one should do is still open, so it keeps Python's own answer.
    $B.$setattr1 = (obj, attr, value, inum) => {
        if ($B.$getattr(obj, attr, MISSING) === MISSING) {
            try {
                $B.$getitem(obj, attr);
                return $B.$setitem(obj, attr, value);
            } catch {
                /* no such key: the real assignment decides */
            }
        }

        return originalSet(obj, attr, value, inum);
    };

    try {
        return run();
    } finally {
        $B.$getattr_pep657 = original;
        $B.$setattr1 = originalSet;
    }
}

// What `(obj.attr := value)` and `(obj[key] := value)` compile to, the two the
// walrus has that Python's own grammar refuses it.
//
// The dot carries the same rule `inTemplate` installs for a read: an existing
// key wins over an attribute, so the write lands where the read came from. The
// rule is repeated here rather than borrowed, because a handler fires on the
// click, long after the expression that built it has left `inTemplate` and put
// the original `$setattr1` back. Borrowing it set a JavaScript property on the
// dict instead: no error, no effect, and the field back to its old value on the
// next render.
//
// They return the value, as an assignment expression must, so that a group can
// hold several and `{count}` still reads afterwards.
export function writeAttr(target, name, value) {
    const $B = globalThis.__BRYTHON__;

    if ($B.$getattr(target, name, MISSING) === MISSING) {
        try {
            $B.$getitem(target, name);
            $B.$setitem(target, name, value);

            return value;
        } catch {
            /* no such key either: the real assignment decides, and may raise */
        }
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
// What the element carries is read off the node, `type` and `value`, so the
// markup pass never has to look at the rest of the tag. The value is therefore
// the DOM's, which is text: `value={5}` binds "5", exactly as a plain HTML form
// would hand it over.
export function group(node, [current, write]) {
    const boxes = node.type === 'checkbox';

    const show = (value) => {
        node.checked = boxes
            ? Array.from(value ?? []).includes(node.value)
            : String(value) === node.value;
    };

    const changed = () => {
        if (!boxes) return write(node.value);

        // A checkbox group is a list, and it has to arrive as Python's: an array
        // built here reads as a JavascriptArray, which prints `[a, c]` where
        // Python prints `['a', 'c']` and refuses a slice.
        const kept = Array.from(node.$svelthonGroup ?? []).filter((one) => one !== node.value);

        write(__pybridge.list(node.checked ? [...kept, node.value] : kept));
    };

    node.$svelthonGroup = current;
    node.addEventListener('change', changed);
    show(current);

    return {
        update([next]) {
            node.$svelthonGroup = next;
            show(next);
        },
        destroy() {
            node.removeEventListener('change', changed);
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
export function bind(proto, key, get, set) {
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

