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
    error.ob_type !== undefined &&
    error.__traceback__ !== undefined;

// A Python iterable materialised the way `list()` would, minus the shortcut
// `list()` takes when it is handed an array: Brython's constructor copies the
// storage of anything array-shaped, so asking it about a list subclass answers
// the question with the question.
//
// `make_js_iterator` is the engine's own entry, and it carries both obligations
// this has to keep. It runs `iter()`, which is the only call that *validates*
// the protocol: `__iter__` returning a plain list is a TypeError in the script,
// and the template used to swallow it and render the list anyway. And it keeps
// the storage fast path exactly where it is still true — Brython copies it onto
// a subclass only when that subclass leaves `__iter__` alone — so a subclass
// that adds a method and nothing else still walks its array.
//
// `$B.NULL` as the frame is how the engine itself calls this from JavaScript:
// there is no Python line to attribute here, and the alternative writes a line
// number into whatever frame happens to be current.
function iterated(value) {
    const $B = globalThis.__BRYTHON__;

    return _b_.list.$factory($B.$call($B.$getattr(value, '__iter__')));
}

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
        } catch (error) {
            if (raised(error)) throw error;
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
        if (Array.isArray(value)) {
            // A list **subclass** that redefines `__iter__` iterates through
            // Python, not through its storage.
            //
            // A Brython list is a JavaScript array, so handing the array
            // straight to `{#each}` is right for a list, and wrong the moment a
            // subclass says what iterating it means. `[x for x in rows]`
            // answered `[3, 2, 1]` in Python while the loop beside it showed
            // `123`, for the same object: the storage is not the sequence when
            // the author has said otherwise.
            //
            // Asked of the class, and only when the class is not `list` itself,
            // so an ordinary loop pays one identity compare.
            const rows =
                value.ob_type !== undefined &&
                value.ob_type !== _b_.list &&
                value.ob_type !== _b_.tuple
                    ? value
                    : value;

            // Hand the watch down to the rows: {#each} walks the array in
            // JavaScript, never through $getitem, so this is the only path by
            // which an item can come under watch before its block reads it.
            //
            // The rows the loop is given, not the storage they came from: a
            // subclass is free to yield a child its list never held, and that
            // child is exactly the one the loop will render and the program will
            // mutate.
            if (MARKS.has(value)) {
                for (const item of value) inherit(value, item);
            }

            return rows;
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

// Methods that change a container.
//
// `__setitem__` and `__delitem__` are here, and the line that kept them out was
// right about the wrong thing: Brython does compile `d[k] = v` and `del d[k]` to
// their own calls, caught below, and that is a statement about the *statement*.
// An author calling the method by name is ordinary Python and is what a generic
// helper writes — `rows.__setitem__(0, 1)`, the same method kept as a value, or
// reached through the type. Those three reach the container and nothing else.
const MUTATORS = new Set([
    '__setitem__', '__delitem__',
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

            for (const arg of args) {
                if (consumed(arg)) spent = true;
                else inherit(obj, arg);
            }

            if (spent) adopt(obj);
            if (attr === 'setdefault') inherit(obj, result);
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
                inherit(obj, child);
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
        const followed =
            obj !== null && typeof obj === 'object' && MARKS.has(obj) && FOLLOWED.has(attr);

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

        result = callAttr(obj, attr, ...rest);
        afterCall(obj, attr, result, rest.slice(1));
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
            // The same `finally` as the interception above, for the same
            // reason: a detached mutator that raises may have mutated first.
            let result;

            result = method(...args);
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

        if (obj === null || typeof obj !== 'object') return result;

        // Wrapped whether or not the object is watched **yet**. The decision
        // used to be taken here, at the read, and never revisited: a factory
        // that hands out its state and an operation on it — `values, add =
        // make()` — gives the operation away before the state has a name, so the
        // list became reactive afterwards and `add(1)` told nobody, for ever.
        // `afterCall` asks at the call instead, which is the moment that knows.
        if (FOLLOWED.has(attr)) {
            // Three shapes reach here and only the first is a function. A
            // special method read off a builtin is a `method-wrapper`
            // (`rows.__setitem__`), one read off a type is a
            // `method_descriptor` (`list.append`); both are objects, and both
            // are called through Python's own protocol.
            const call =
                typeof result === 'function'
                    ? result
                    : result !== null &&
                        typeof result === 'object' &&
                        (result.ob_type === $B.method_wrapper ||
                            result.ob_type === $B.method_descriptor)
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

            if (typeof result === 'function') return notifying(obj, attr, result);

            if (call !== null) {
                return (...args) => {
                    let out;

                    try {
                        out = call(...args);
                        return out;
                    } finally {
                        afterCall(obj, attr, out, args);
                    }
                };
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
        inherit(obj, result);

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
                inherit(obj, key);
                inherit(obj, value);
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

        inherit(obj, value);
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
            // items()` cannot: the generator kept nothing. The same two answers
            // as the method paths above, and the same question decides.
            if (consumed(right)) adopt(left);
            else inherit(left, right);

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

// An argument that hands its contents over and keeps none of them: an iterator.
//
// `rows.append(child)` is given the very thing that lands, so the watch goes to
// the argument and the link is one assignment. `rows.extend(items())` is given a
// **source**, and by the time this is asked the generator is empty: the children
// are inside the container and nothing at all points at them, so the page went
// on showing `[[]]` while Python held `[[1]]`.
//
// Telling the two apart is what decides between the cheap link and the walk, and
// the walk cannot be the answer for both: a thousand-row list would pay for its
// whole length on every `append`.
//
// Asked of the class, where Python keeps the answer, and it is the whole
// definition of an iterator: a value with `__next__`. A list, a tuple, a dict
// and a set are re-iterable and still hold what they were handed, so they take
// the link. An array is stepped over before the class is asked, since no Python
// sequence represented as one is an iterator.
function consumed(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;

    const $B = globalThis.__BRYTHON__;

    try {
        return $B.search_slot($B.get_class(value), 'tp_iternext', $B.NULL) !== $B.NULL;
    } catch {
        return false; // a foreign JavaScript value is not ours to ask
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
export const pyClass = (value) => false \g<0>\g<0> /*W*/
    value !== null &&
    typeof value === 'object' &&
    value.ob_type !== undefined &&
    value.tp_name !== undefined &&
    value.tp_bases !== undefined;

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
// *Root* is what every realm's `Object.prototype` has in common and what no
// class prototype has: a `Date` sits on `Date.prototype`, which sits on
// `Object.prototype` in turn, so it is two steps from null and stays excluded —
// here and in every other realm.
export const plainObject = (value) => {
    const prototype = Object.getPrototypeOf(value);

    return prototype === null || Object.getPrototypeOf(prototype) === null;
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

    if (value.ob_type === undefined) return false;

    return declares(value.ob_type, '__slots__') !== $B.NULL;
};

// The two Python sets, asked by class the way the dict above is. Anything else
// carrying a `$store` is not one, and a foreign object is not walked at all.
const isSet = (value) => {
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
    const marker = () => upwards(marker, ++walked, 'bumps');

    marker.bumps = [];
    marker.reads = [];
    marker.follow = () => upwards(marker, ++walked, 'reads');

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
        inherit(value, attributes);
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
    // run by the act of watching. Arrays are stepped over because their keys are
    // their indices, and a long list would pay for a scan that cannot match.
    if (!Array.isArray(value)) {
        for (const key of Object.keys(value)) {
            if (key.startsWith(SLOT)) inherit(value, value[key]);
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
        for (const child of value) inherit(value, child);
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
            inherit(value, child);
        }
    } else if (isSet(value)) {
        // `$store` maps a hash to the bucket of members that share it, which is
        // the set's own layout, read the way the dict above is read rather than
        // through `__iter__`: an iteration goes back through `$getattr`, which
        // this file intercepts, and the walk would re-enter itself.
        //
        // A frozenset is here too. What it freezes is the membership, not the
        // members, and a `Box()` inside one is as mutable as anywhere else.
        for (const bucket of Object.values(value.$store)) {
            for (const child of bucket) inherit(value, child);
        }
    }
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
    if (value === null || typeof value !== 'object' || value.ob_type === undefined) return undefined;

    const mro = value.ob_type.tp_mro;

    if (!Array.isArray(mro)) return value.ob_type === _b_.float ? value.value : undefined;
    if (mro.includes(_b_.float) || mro.includes(_b_.int)) return value.value;
    if (mro.includes(_b_.str)) return value.$brython_value;

    return undefined;
};

function thrown(error) {
    if (error instanceof Error || error === null || typeof error !== 'object') return error;

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

// Awaitable, asked the way `await` itself asks: a `then` that can be called.
//
// `instanceof Promise` asks about *our* Promise constructor, and a promise built
// in another JavaScript context has its own — the same realm mistake as `URL`
// and `Date`, at the one site where it decides whether a **resolved** value gets
// converted. A `.py` module handing back `js.fetch_from_frame()` answered its
// JavaScript caller with a raw Brython dict, symbols and all, where the same
// function returning a local promise answered `{answer: 42}`.
//
// Measured and dismissed a day earlier, on the reasoning that a foreign promise
// resolves to a JavaScript value with nothing to convert. That is true of a
// promise a foreign library made *for itself*, and false the moment it was
// handed a Python value to resolve with — which is exactly what a `__js__`
// helper does. The measurement was right and the inference from it was not.
//
// No Python value answers this by accident: Brython keeps an object's
// attributes under a symbol, so a plain `.then` read finds nothing on a dict, a
// list or an instance.
// A **function** is one too, and that is the language's rule rather than a
// courtesy: `await fn` and `Promise.resolve(fn)` call `fn.then` like anyone
// else's. Asking `typeof === 'object'` left the one awaitable shape that is also
// a callable on the synchronous road, so what it resolved to crossed as a raw
// Brython dict while an awaitable *object* beside it crossed as data.
const thenable = (value) =>
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof value.then === 'function';

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
        started(result).then(
            resolve,
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
export function plainData(value, seen, adapt) {
    if (value === undefined || value === null || value === NONE) return null;
    if (typeof value === 'function') return adapt === undefined ? value : adapt(value);

    // A callable that `typeof` calls an object — a bound method, an instance
    // whose class defines `__call__` — and only when someone asked for
    // adaptation: with no rule there is nothing to do with it, and the walk
    // below is what it has always had.
    if (adapt !== undefined && callable(value)) return adapt(value);
    if (typeof value !== 'object') return value;

    // A Brython float is an object holding a number and a reference to its
    // type. `tojson(1 / 3)` walks the lot: 20 KB of `ob_type`. A subclass of one
    // takes the same road, with the same answer.
    const scalar = pyScalar(value);

    if (scalar !== undefined) return scalar;

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
            return branch(value, seen, undefined, adapt);
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
    const shell = Array.isArray(value) ? [] : {};

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
    return out;
}

function branch(value, seen) {
    if (Array.isArray(value)) return value.map((one) => plainData(one, seen)); // list, tuple

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

    if (!mapping && (holder !== undefined || declaresSlots(value))) {
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

    // A Brython list and a Brython tuple are JavaScript arrays too, told apart
    // from a foreign one by the `ob_type` they carry. Rebuilding one made a list
    // of a tuple — the immutability went, and with it the right to be a dict key
    // — and made a copy of a list, so a guard put on data that turned out to be
    // Python's already quietly detached it from the name it came from.
    if (Array.isArray(value)) {
        return value.ob_type !== undefined ? value : _b_.list.$factory(value.map(pyData));
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
const urlish = (value) => {
    try {
        return (
            typeof value?.pathname === 'string' &&
            typeof value?.protocol === 'string'
        );
    } catch {
        return false;
    }
};

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
const routeEvent = (value) =>
    typeof value.fetch === 'function' &&
    urlish(value.url) &&
    typeof value.request?.method === 'string' &&
    typeof value.request?.headers?.get === 'function' &&
    value.params !== null &&
    typeof value.params === 'object';

export function pyArg(value) {
    if (value === null || typeof value !== 'object') return pyBind(value);
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
// The outer half of a configuration's callback: the adapter, plus the arguments
// converted on the way in, which is what a framework calling with raw numbers
// needs and what `pyHandler` alone does not do.
//
// Memoised on the adapter it wraps, because **the function a consumer sees is
// this one**. `pyHandler` hands back a stable wrapper and this layer built a
// fresh one at every conversion, so a component read twice gave two JavaScript
// functions for one Python callback and a registry could not remove what it had
// been given. The cache inside does not settle identity if the value published
// is a new object wrapped around it.
//
// A WeakMap, so nothing here keeps a component's callbacks alive.
const CONVERTED = new WeakMap();

function converting(wrapped) {
    let known = CONVERTED.get(wrapped);

    if (known === undefined) {
        // Named after what it wraps, like the other wrappers in this file: a
        // callback a framework keeps is exactly the one somebody logs.
        known = identified((...args) => wrapped(...args.map(inbound)), wrapped.name, wrapped.length);

        CONVERTED.set(wrapped, known);
    }

    return known;
}

export function pyNumbers(value) {
    if (value === null || typeof value !== 'object') return value;

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
            const wrapped = pyHandler(one);

            if (wrapped === one) continue;

            replacement = converting(wrapped);
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
const taken = (args, arity) => args.slice(0, arity).map(pyArg);

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

export function pyCall(fn, where, lineOffset = 0, arity = Infinity, named) {
    const wrapper = (...args) => {
        try {
            const given = taken(args, arity);
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
            // `Promise.resolve` rather than `result.then`, because a bare
            // thenable's `then` answers whatever its author wrote — `undefined`
            // for the three-line shape everyone writes — and what a caller was
            // handed has to stay awaitable. This normalises all three into one
            // promise of this realm, which is also what `await` would do.
            return thenable(result)
                ? Promise.resolve(result).then((one) => plainData(one, undefined, pyHandler))
                : plainData(result, undefined, pyHandler);
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

    return identified(wrapper, named ?? ((Array.isArray(infos) && infos[2]) || nameOf(where)), arity);
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

    if (value === null || typeof value !== 'object' || value.ob_type === undefined) return null;
    if (pyClass(value) || boundMethod(value)) return null;

    const found = declares(value.ob_type, '__call__');

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
    typeof value === 'function' || boundMethod(value) || callDescriptor(value) !== null;

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
    const method = boundMethod(value) ? value : null;
    const call = method === null ? callDescriptor(value) : null;

    if (method === null && call === null && typeof value !== 'function') return null;

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
    const stat = call !== null && call.sm_callable !== undefined ? call.sm_callable : null;
    const held = method !== null ? method.im_func : (stat ?? call ?? value);
    const fn = typeof held.$js_func === 'function' ? held.$js_func : held;
    const infos = fn.$function_infos;

    // Nothing of Python's at all: a function JavaScript built, which crosses as
    // the object its library made.
    if (!Array.isArray(infos)) return null;

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
        if (method !== null || call !== null) return null;

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
    // So the two halves move together. `Infinity` goes upward, since the wrapper
    // that would trim is built once, and the trim happens here instead, against
    // whatever the class holds now. The wrapper's identity is untouched, which is
    // what a registry that holds a callback needs.
    return {
        fn: (...args) => {
            const now = liveArity(value);

            return globalThis.__BRYTHON__.$call(value, ...args.slice(0, now));
        },
        where,
        arity: Infinity,
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
    const held = stat ?? call;
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

export function pyHandler(value) {
    const found = declared(value);
    if (found === null) return value;

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

    const wrapped = pyCall(found.fn, found.where, 0, found.arity, found.named ?? undefined);

    // An instance trims at the call, against whatever its class holds now, so its
    // wrapper announces `Infinity` and would report an arity of 0. What a library
    // reads should be what the call takes, and a snapshot of it is what a
    // JavaScript function's `length` is anyway.
    if (found.instance) identified(wrapped, wrapped.name, liveArity(value));

    cache.set(key, wrapped);

    return wrapped;
}

function perReceiver(self) {
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
const outbound = (value, made) =>
    typeof value === 'function' ? pyHandler(value) : plainData(value, made, pyHandler);

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
    // An imported constant crosses here too, and it crosses once: `export const
    // half = 0.5` reached Python as a raw JavaScript number, where `half * 2`
    // worked and `format(half, ".2f")` answered *non-empty format string passed
    // to object.__format__*. The same 0.5 returned by an imported *function*
    // came back a float, because the call goes through `inbound`. One value, two
    // capabilities, decided by the way it entered.
    if (typeof value !== 'function') return pyBind(value);

    return new Proxy(value, {
        // The memo is made here and not above, so it lasts exactly one call: a
        // longer-lived one would hand a later call the snapshot an earlier one
        // took, after Python had moved on.
        apply: (target, self, args) => {
            const made = new WeakMap();

            return inbound(Reflect.apply(target, self, args.map((one) => outbound(one, made))));
        }
    });
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
    // its library made, marks included. `declared` answers null for it.
    if (declared(value) !== null) return exported(value);

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

    const pairs = pyEntries(value);

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
    if (pairs.some(([, one]) => callable(one))) {
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
// what an expression function does with them differs — it runs inside
// `inTemplate` and takes its values already Python — and that difference is the
// compiler's to write.
//
// The result goes through `pyNumbers`, not `plainData`: what a component hands
// the *framework* is a transition's options or an action's teardown, and a
// Brython float there is an object `Element.animate` refuses. A coroutine is
// fired and not awaited, since nobody reads what a handler returns.
const running = (call, where, lineOffset) => {
    try {
        return pyNumbers(schedule(call(), where, lineOffset));
    } catch (error) {
        throw pyError(error, where, lineOffset);
    }
};

export const pyComponent = (call, where, lineOffset, arity) =>
    identified(
        (...args) => running(() => call(taken(args, arity)), where, lineOffset),
        nameOf(where),
        arity
    );

// And the other half of the same wrapper: a function the *markup* compiled, one
// per expression it met.
//
// Two things separate it from the one above, and both belong to the template
// rather than to the boundary. Its arguments are already Python — a block's own
// name, a snippet's parameter — so converting them would convert twice. And it
// runs inside `inTemplate`, where a dot finds a key as well as an attribute,
// which is the seam a template expression is written against.
//
// Two names rather than a flag, so the compiler *chooses* a wrapper instead of
// describing one: what it writes is a name, and everything a crossing does is on
// this side of the line.
export const pyExpression = (call, where, lineOffset, arity) =>
    identified(
        (...args) => running(() => inTemplate(() => call(args.slice(0, arity))), where, lineOffset),
        nameOf(where),
        arity
    );

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

                // Callable in Python, which is the question every boundary that
                // promises to adapt a callback asks, and the one this site was
                // still answering with `typeof`. A module publishing
                // `fade = Fades(0.3).run` — an object configured once, its
                // method named by the directive — handed Svelte a value it
                // cannot call, and so did a callable instance and a
                // classmethod, for a body that worked the moment it was
                // written as a `def`. Four shapes out of six, at the one
                // crossing the other passes never visited.
                const found = declared(member);

                if (found === null && typeof member !== 'function') return member;

                let wrapped = directives.get(member);

                if (wrapped === undefined) {
                    // Trimmed to the arity Python declared, exactly as a
                    // handler is: Svelte calls a transition `fn(node, params,
                    // options)`, and `def typewriter(node, params)` refuses the
                    // third. A `def` written in the component is trimmed by its
                    // own wrapper, which is why it worked and this did not.
                    //
                    // `declared` reads the same three things this site used to
                    // read by hand, for every shape rather than for one: the
                    // receiver is bound, the signature is read through
                    // `$js_func`, and `self` is not counted among the
                    // arguments. It answers null for a function JavaScript
                    // built, which then keeps the reading it always had — no
                    // signature, so no trim.
                    const called = found === null ? member : found.fn;
                    const arity = found === null ? Infinity : found.arity;
                    const where = found === null ? `${name}.${key}()` : found.where;

                    // Named like every other wrapper this file builds, and for
                    // the same reason: what a JavaScript caller reads of a
                    // Python function must not depend on the route it took.
                    wrapped = identified(
                        (...args) => {
                            try {
                                // Converted on the way in, like every other
                                // call boundary: Svelte hands an action or a
                                // transition its JavaScript values, and a
                                // fractional one reaching `format(value, '.2f')`
                                // answered *non-empty format string passed to
                                // object.__format__* and took the mount with it.
                                // A DOM node is left alone by `pyArg`, which is
                                // what the first argument always is here.
                                return pyNumbers(called(...taken(args, arity)));
                            } catch (error) {
                                throw pyError(error, where);
                            }
                        },
                        nameOf(where),
                        arity
                    );

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
        if ($B.$getattr(obj, attr, MISSING) === MISSING && keyed(obj, attr)) {
            // Outside the `try`: once the key is found the destination is
            // decided, and what `__setitem__` raises is the author's own answer.
            return $B.$setitem(obj, attr, value);
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

// Whether the dot should write a key rather than an attribute: the object has
// one of that name.
//
// **The probe and the write are two statements, and that is the whole point.**
// They were one `try`, so an exception raised by the author's own `__setitem__`
// read as "no such key" and the write moved to an attribute instead: a `Guard`
// refusing every write with a `ValueError` ended up carrying `obj.name` beside
// the entry it had protected, the dot reading the new one and the subscript
// still reading the old. A refusal became two truths and no error.
//
// Once the key is found the destination is decided, and what the write raises is
// the author's answer, not a reason to write somewhere else.
function keyed(target, name) {
    try {
        globalThis.__BRYTHON__.$getitem(target, name);
        return true;
    } catch {
        return false;
    }
}

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
export const pyBind = (value) =>
    typeof value === 'number' ? globalThis.__BRYTHON__.jsobj2pyobj(value) : value;

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

    if ($B.$getattr(target, name, MISSING) === MISSING && keyed(target, name)) {
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
// A form reset moves the controls without firing `change` on any of them, so a
// group that listens for `change` alone keeps what the clicks left in it while
// the form on screen says otherwise — and the list is what gets submitted.
//
// One listener for the whole document, in the capture phase so nothing can stop
// it, and the work done one microtask later: when the event fires the controls
// have not been put back yet, so `checked` still reads the old state. Svelte's
// own binding is built the same way, for the same reason.
const RESETS = new WeakMap();

let watching = false;

function watchReset() {
    if (watching || typeof document === 'undefined') return;

    watching = true;
    document.addEventListener(
        'reset',
        (event) => {
            const form = event.target;

            queueMicrotask(() => {
                if (event.defaultPrevented) return;

                const inputs = [...form.elements].filter((one) => RESETS.has(one));

                // The group each input belongs to, read *before* any of them
                // writes: the first write re-renders, which hands the others a
                // new list, and the rebuild below needs one key per group.
                const groups = new Map(inputs.map((one) => [one, one.$svelthonGroup]));
                const rebuilt = new Map();

                // The filled ones last. A radio group writes once per input, and
                // the one that came back filled has to have the final word over
                // the others, which write absence.
                for (const one of inputs) if (!one.checked) RESETS.get(one)(rebuilt, groups.get(one));
                for (const one of inputs) if (one.checked) RESETS.get(one)(rebuilt, groups.get(one));
            });
        },
        { capture: true }
    );
}

// Which group an input belongs to, in a design that gives the group no identity
// of its own. Three things, and each one alone is wrong:
//
//   the instance   two instances of one component share the binding text, and
//                  may share the list they were handed
//   the binding    `left = shared` and `right = shared` are two bindings on one
//                  list, in one instance
//   the list       the rows of an `{#each}` are one binding and one group each
//
// The first two are stable for the life of the component, so they are folded
// into a token here and the list is the key the rebuild uses.
const GROUPS = new WeakMap();

function groupToken(scope, binding) {
    if (scope === null || typeof scope !== 'object') return binding;

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

export function group(node, [current, write, chosen, binding, scope]) {
    const boxes = node.type === 'checkbox';
    const given = (picked) => (picked === undefined ? node.value : pyBind(picked));
    const token = groupToken(scope, binding);

    let value = given(chosen);

    // Python's `==`, not JavaScript's `===`. A Brython float is an object
    // `{ob_type, value}`, so `value={0.5}` evaluated twice is two objects and
    // identity answers false for what the author wrote as one value. `==` and
    // `in` are also what a Python author reads in a group.
    // Python's comparison, read as Python reads it. Asking `=== true` of the
    // answer is a narrower question than the one that was asked: `__eq__` may
    // return anything, and `return int(self.n == other.n)` gives 1 — true to
    // Python, and not the JavaScript boolean. A choice already present in the
    // state then showed as unselected.
    const same = (one) => {
        try {
            return __pybridge.truthy(globalThis.__BRYTHON__.rich_comp('__eq__', one, value));
        } catch (error) {
            // An `__eq__` of the author's that raises is not a "no". The fall
            // back to identity is for a value Python cannot compare at all — a
            // foreign JavaScript one — and using it for a failed protocol
            // answered *plausibly and wrongly*: two distinct instances, so the
            // control showed nothing selected while the model had not managed to
            // compare anything. Same rule as `__pybridge.truthy` one file up.
            if (raised(error)) throw pyError(error, `bind:group={${binding}}`);

            return one === value;
        }
    };

    const show = (held) => {
        node.checked = boxes ? Array.from(held ?? []).some(same) : same(held);
    };

    const changed = () => {
        if (!boxes) return write(value);

        // A checkbox group is a list, and it has to arrive as Python's: an array
        // built here reads as a JavascriptArray, which prints `[a, c]` where
        // Python prints `['a', 'c']` and refuses a slice.
        const kept = Array.from(node.$svelthonGroup ?? []).filter((one) => !same(one));

        write(__pybridge.list(node.checked ? [...kept, value] : kept));
    };

    // What the reset writes back, once the control has been put back. A radio
    // that came back empty writes absence rather than nothing at all, so a group
    // whose inputs carry no `checked` reaches Python as None instead of keeping
    // the answer the reset just threw away.
    const restored = (rebuilt, held) => {
        if (!boxes) return write(node.checked ? value : NONE);

        // Which inputs belong together: the token is the instance and the
        // binding, the list is the third half — see `groupToken`.
        let lists = rebuilt.get(token);

        if (lists === undefined) {
            lists = new Map();
            rebuilt.set(token, lists);
        }

        let kept = lists.get(held);

        if (kept === undefined) {
            kept = [];
            lists.set(held, kept);
        }
        if (node.checked) kept.push(value);

        write(__pybridge.list([...kept]));
    };

    node.$svelthonGroup = current;
    node.addEventListener('change', changed);
    RESETS.set(node, restored);
    watchReset();
    show(current);

    return {
        update([next, , picked]) {
            node.$svelthonGroup = next;
            value = given(picked);
            show(next);
        },
        destroy() {
            node.removeEventListener('change', changed);
            RESETS.delete(node);
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

