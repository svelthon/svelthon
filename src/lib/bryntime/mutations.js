// The mutation tracking: a watched Python value tells its readers whenever it
// is mutated, and every container inside a watched one is watched too. Moved
// out of the runtime as it was; it reaches its host only through `host`, and
// the host reaches it through `bryntime.js`.
import * as core from './core.js';

const { NONE, VIEW_OF, _b_, authoredClass, callable, declares, host, isSet, isTuple, javascriptOwn, ownAttributes, ownType, pyBytes, pyClass, pyEntries, quietPyType, slotValues } = core;

// How a set's view takes out the member its own lookup found, and tells it
// (`SetView.delete`): the mutation tracking's, which sets it.
export let removeFound;

// How a read of a declared class follows its metaclass's special methods
// (`__pybridge.declared`): the mutation tracking's, which sets it.
export let followMetaclass;

// The classes something may read: one read by a name (`className`), one whose
// name holds a watched value (`nameMarker`), one an object is looked up through
// (`enrol`), one watched (`mark`). A write to any other class, or to an object
// that is no class, tells nobody, and is asked nothing more
// (`beforeClassWrite`, `classNameChanged`).
const READ_CLASSES = new WeakSet();

// Each value a block declares (`__pybridge.state`).
export const BLOCK_STATE = new WeakSet();

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
    if ($B.$bryntimeTracking) return;
    $B.$bryntimeTracking = true;

    // A WeakMap holds no key but an object or a function, so whether something
    // is watched is one lookup, whatever it is.
    const notify = (obj) => {
        if (MARKS.has(obj)) MARKS.get(obj)();
    };

    // **A write Svelte refuses changes nothing**, as in Svelte, whose state
    // refuses a write before it stores it (`state_unsafe_mutation`, a write
    // made while a derived or a block reads). A write of Python's is made
    // before anything is told, and the refusal came from telling the readers:
    // the model kept what the page refused, and an author who caught the
    // error read two answers. So where writes are refused (`host.refuses`), what
    // a watched container stores is copied before the write (`saving`), and
    // put back if telling its readers is refused (`settle`). A write that
    // changes nothing tells nobody, and passes, as Svelte's own collections
    // let it; one allowed tells its readers as it did, in a `finally`. A write
    // known beforehand to change nothing, the call's name and arguments given,
    // copies nothing (`unchanging`).
    //
    // A class is told first instead (`beforeClassWrite`): written, it changes
    // more than itself, the caches of its subclasses, their order of lookup
    // and the bases' lists of subclasses, which no copy of the class puts
    // back. Told first, a refused write is never made; and a write to a class
    // tells its readers whatever it writes, so telling them first decides
    // what telling them after would.
    const saving = (target, name, args) =>
        MARKS.has(target) && host.refuses() && !(name !== undefined && unchanging(name, target, args)) ? storageOf(target) : undefined;

    const beforeClassWrite = (obj, attr) => {
        // Asked first whether anything could read it, one lookup an object
        // nobody reads misses, since every attribute write comes through here.
        if (!READ_CLASSES.has(obj) || !host.refuses()) return;

        classNameChanged(obj, attr);
        notify(obj);
    };

    const settle = (target, saved, tell) => {
        if (saved === undefined) return tell();

        try {
            return tell();
        } catch (error) {
            putBack(target, saved);
            throw error;
        }
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

    // A member a set's view found by its own lookup (`SetView.delete`), taken
    // out as the engine's `discard` takes it out, `set_remove` then
    // `$version`, and told as that call is told: copied first where a write is
    // refused, put back if its readers refuse it.
    removeFound = (set, hash, at, asked) => {
        const member = set.$store[hash]?.[at] ?? asked;
        const saved = saving(set);

        if (set.$store[hash] !== undefined) {
            set.$store[hash].splice(at, 1);
            if (set.$store[hash].length === 0) delete set.$store[hash];
            set.$used -= 1;
        }

        set.$version += 1;
        settle(set, saved, () => afterCall(set, 'discard', NONE, [member]));
    };

    // **Whether a call on a watched set or dict changed it**, told as Svelte's
    // own collections tell it: a `SvelteSet` adding a member it holds, deleting
    // one it lacks or clearing itself empty, and a `SvelteMap` setting a key to
    // the value it holds, write nothing, and neither do these. A list is
    // Svelte's array, which writes on any of its mutators, `push()` with
    // nothing included.
    //
    // Two halves. What the author's code does to the container while the call
    // runs, a `__hash__`, an `__eq__` or a source's `__iter__` calling one of
    // its mutators, is seen as it happens (`atSource`), and such a call
    // changed it. What the call does itself is told off the storage alone,
    // never by asking a key or a member anything: a set's size, which its own
    // `add` or `update` can only grow and its own `discard` or
    // `difference_update` only shrink, and where it may do both, its count of
    // members added as well, `$version`, which a removal leaves alone; a dict's
    // count of keys added and removed, `VERSION`, and its string keys, which a
    // dict of string keys alone holds as its own properties; and
    // `intersection_update`, which rebuilds the set from the other one's
    // objects, by the members the set holds after, one by one. A call it
    // cannot tell, `null`, changed.
    const SET_SIZED = new Set(['add', 'discard', 'remove', 'pop', 'clear', 'update', 'difference_update']);

    // The engine's own fields of a dict, found on one it made: `VERSION`, the
    // count of keys added and removed, and `KEYS`, held once its keys are no
    // longer all strings. Without them, every call changed.
    const dictField = (() => {
        const made = _b_.dict.$factory();

        _b_.dict.$setitem(made, 'key', 1);
        _b_.dict.$setitem(made, 1, 1);

        const fields = new Map(Object.getOwnPropertySymbols(made).map((one) => [one.description, one]));

        return (name) => fields.get(name);
    })();
    const VERSION = dictField('VERSION');
    const KEYS = dictField('KEYS');
    const VALUES = dictField('VALUES');
    const TABLE = dictField('TABLE');

    // A value the engine alone hashes and compares: a number, a string, bytes,
    // None, and a tuple or a frozenset of them.
    const PLAIN = [_b_.int, _b_.float, _b_.complex, _b_.str, _b_.bytes, _b_.bool, $B.get_class(NONE)];
    const plain = (one) => {
        if (one === null || typeof one !== 'object') return ['number', 'string', 'boolean', 'bigint'].includes(typeof one);

        const type = quietPyType(one);

        if (type === _b_.tuple) return one.every(plain);
        if (type === _b_.frozenset) return Object.values(one.$store).flat().every(plain);

        return PLAIN.includes(type);
    };

    // What a dict holds for a key, or a set for a member, found as the engine
    // finds it, by its hash and then by equality with what is filed under it,
    // and without running anything of the author's: the value held (a set's
    // member itself), `MISSING` if there is none, and undefined when finding it
    // would hash or compare a value that is not plain.
    const heldPlainly = (target, one) => {
        if (!plain(one)) return undefined;

        const hash = $B.$hash(one);
        const found = (keys, at) => {
            for (const index of at ?? []) {
                const key = keys(index);

                if (key === undefined) continue;
                if (!plain(key)) return undefined;
                if ($B.is_or_equals(key, one)) return index;
            }

            return MISSING;
        };

        if (isSet(target)) return found((member) => member, target.$store[hash]);

        if (!$B.is_dict(target) || NAMESPACE_DICTS.has(target) || TABLE === undefined || VALUES === undefined) return undefined;
        if (target[KEYS] === undefined) return typeof one === 'string' && Object.hasOwn(target, one) ? target[one] : MISSING;

        const at = found((index) => target[KEYS][index], target[TABLE][hash]);

        return at === undefined || at === MISSING ? at : target[VALUES][at];
    };

    // Whether a value written is the one held, as a `SvelteMap` tells it: the
    // same object, or the same value as both cross (`crossed`), a float of
    // the engine's by its number, of the same type and the same sign: `1.0`
    // written over `1`, or `-0.0` over `0.0`, are one number to JavaScript and
    // two to the page, which shows each as Python writes it.
    const sameValue = (one, held) => {
        if (one === held) return true;

        const native = crossed(one);

        return native !== UNCROSSED && quietPyType(one) === quietPyType(held) && Object.is(native, crossed(held));
    };

    // The entries an `update` writes, in order, when reading them runs nothing
    // of the author's and spends nothing: a dict's, the pairs of a list or a
    // tuple, each a list or a tuple of two, and keywords given by name.
    // Undefined for anything else: an iterator is read once, by the call, and
    // a mapping of the author's may answer anything.
    const updateWrites = (args) => {
        const writes = [];

        for (const one of args) {
            if (one !== null && typeof one === 'object' && one[$B.KW] !== undefined) {
                const [named, ...spread] = one[$B.KW];

                if (spread.length > 0) return undefined;

                for (const key of Object.keys(named ?? {})) writes.push([key, named[key]]);
                continue;
            }

            const type = quietPyType(one);

            if (type === _b_.dict) {
                writes.push(...pyEntries(one));
            } else if (type === _b_.list || type === _b_.tuple) {
                for (const pair of one) {
                    const kind = quietPyType(pair);

                    if ((kind !== _b_.list && kind !== _b_.tuple) || pair.length !== 2) return undefined;

                    writes.push([pair[0], pair[1]]);
                }
            } else {
                return undefined;
            }
        }

        return writes;
    };

    // Whether a dict holds every entry a write puts in it already
    // (`heldPlainly`, `sameValue`): undefined when a key is not plain.
    const holdsAlready = (target, writes) => {
        for (const [key, value] of writes) {
            const held = heldPlainly(target, key);

            if (held === undefined) return undefined;
            if (held === MISSING || !sameValue(value, held)) return false;
        }

        return true;
    };

    // A write known beforehand to change nothing (`heldPlainly`), which no copy
    // has to put back: a member added that is held, one discarded that is
    // not, a key set by `setdefault` that is held, keys set to the values they
    // hold, by subscript or by `update`. Copied, it paid the whole container at
    // each such write, and `counts.setdefault(name, 0)` once a row a cost
    // growing with the square of the rows.
    const unchanging = (name, target, args) => {
        if (name === 'update') {
            const writes = updateWrites(args);

            return writes !== undefined && holdsAlready(target, writes) === true;
        }

        if (name === '__setitem__') return holdsAlready(target, [args]) === true;
        if (name !== 'setdefault' && name !== 'add' && name !== 'discard') return false;

        const held = heldPlainly(target, args[0]);

        if (held === undefined) return false;
        if (name === 'discard') return held === MISSING;

        return held !== MISSING;
    };

    const changeOf = (name, target, args) => {
        if (!MARKS.has(target)) return null;

        if (isSet(target)) {
            const size = target.$used;

            if (name === 'symmetric_difference_update') {
                const version = target.$version;

                return () => target.$used !== size || target.$version !== version;
            }

            // Rebuilt from the other one's objects, an equal member held anew
            // by another object, and through the set's own `clear` and `add`:
            // told by the whole set, unchanged when it holds the very members
            // it held, which the calls it makes inside do not overrule
            // (`whole`). Only where Svelte refuses a write: anywhere else the
            // call is told as a change, and does not pay a read of every
            // member before it.
            if (name === 'intersection_update') {
                if (!host.refuses()) return null;

                const held = new Set(Object.values(target.$store).flat());
                const changed = () => target.$used !== held.size || Object.values(target.$store).some((bucket) => bucket.some((one) => !held.has(one)));

                return Object.assign(changed, { whole: true });
            }

            return SET_SIZED.has(name) ? () => target.$used !== size : null;
        }

        if (!$B.is_dict(target) || NAMESPACE_DICTS.has(target) || VERSION === undefined || KEYS === undefined) return null;

        const version = target[VERSION] ?? 0;
        const stringKeyed = target[KEYS] === undefined;
        const key = args[0];

        // A string key of a dict of string keys alone is its own property,
        // which a call may add or remove without counting it in `VERSION`.
        if (name === 'setdefault' || name === 'pop' || name === '__delitem__') {
            const own = stringKeyed && typeof key === 'string';
            const held = own && Object.hasOwn(target, key);

            return () => (target[VERSION] ?? 0) !== version || (own && held !== Object.hasOwn(target, key));
        }

        // And a key written, read there before and after: a string key of a
        // dict of string keys alone as its own property, and any other plain
        // key as the engine finds it (`heldPlainly`). Any other key is hashed
        // by the call alone, which a second look would hash again.
        if (name === '__setitem__') {
            if (!stringKeyed || typeof key !== 'string') {
                const before = heldPlainly(target, key);

                if (before === undefined) return null;

                return () => (target[VERSION] ?? 0) !== version || !sameValue(heldPlainly(target, key), before);
            }

            const held = Object.hasOwn(target, key);
            const before = target[key];

            return () => (target[VERSION] ?? 0) !== version || Object.hasOwn(target, key) !== held || !sameValue(target[key], before);
        }

        if (name === 'popitem') return (result) => result !== undefined;

        if (name === 'clear') {
            const size = _b_.dict.mp_length(target);

            return () => size > 0;
        }

        // An update that writes nothing, or writes the values held already, as
        // a run of `SvelteMap.set` would (`updateWrites`, `holdsAlready`): no
        // key is hashed but by the call, and a source read only once, or a
        // key that is not plain, is left to it.
        if (name === 'update') {
            const writes = updateWrites(args);

            if (writes === undefined) return null;
            if (writes.length === 0) return () => false;

            const unchanged = holdsAlready(target, writes);

            if (unchanged === undefined) return null;

            return () => !unchanged || (target[VERSION] ?? 0) !== version;
        }

        return null;
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
    // object, a `key=` that appends to a list of its own, is its own. A
    // mutator called on the same object meanwhile, by the engine or by the
    // author's `__hash__`, `__eq__` or `__iter__`, is told as the outer call
    // is, by its own effect (`changeOf`), and if it changed the object it
    // `touched` it: the outer call changed it.
    const mutating = new Map();

    const atSource = (name, method) => {
        const sourced = function (target, ...args) {
            // `finally`, because a mutator that raises has often mutated
            // already: `xs.extend(values())` consumes what the generator
            // yielded before it raised, so the list holds `[1]` and the author,
            // who caught the exception, saw the old value on the page for ever.
            // `result` stays undefined on that path; `afterCall` reads it only
            // to hand a returned container the watch.
            if (name === '__setattr__' || name === '__delattr__') beforeClassWrite(target, args[0]);

            const outer = mutating.get(target);
            const nested = outer !== undefined && MUTATORS.has(name);
            const changed = outer === undefined || nested ? changeOf(name, target, args) : null;
            const running = outer ?? { depth: 0, touched: false };
            // Copied before a call that writes alone: a read, `get` among
            // them, writes nothing, and a getter that writes is told by its
            // own write.
            const saved = outer === undefined && MUTATORS.has(name) ? saving(target, name, args) : undefined;
            let result;

            running.depth += 1;
            mutating.set(target, running);
            try {
                result = Reflect.apply(method, this, [target, ...args]);
                return result;
            } finally {
                running.depth -= 1;

                if (running.depth === 0) mutating.delete(target);

                if (nested && (changed === null || changed(result))) outer.touched = true;
                if (outer === undefined && (changed === null || (running.touched && !changed.whole) || changed(result))) {
                    settle(target, saved, () => afterCall(target, name, result, args));
                }
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
    // it under the name of one of JavaScript's mutators notifies once called
    // if it changed it (`nativeChange`), in place, kept as `add = seen.add` or
    // taken by `getattr`. One wrapper per object and method, so two reads are
    // one method. Whether anybody watches is the call's question, as at
    // `afterCall`: a factory that keeps `obj.add` and hands `obj` to the state
    // later keeps a method that notifies once the object is watched.
    const JS_MUTATORS = new Set(['add', 'delete', 'clear', 'set', 'push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin']);
    const JS_WRAPPERS = new WeakMap();

    // What a native method of a `Set` or a `Map` changed, told as Svelte's
    // `SvelteSet` and `SvelteMap` tell it: adding a member held, deleting one
    // absent, clearing an empty one, and setting a key to the value it holds
    // write nothing. Any other method, a class's own `add` among them, changed
    // its object, as an array's mutators do Svelte's array.
    //
    // Told without running anything of the author's, whose code the call runs
    // once and the call alone: the method by its text, which a built-in
    // function of any window has and nothing else, the object by the slot a
    // `Set` or a `Map` of any window holds and a proxy does not, and the change
    // by its size, read before and after. A key set again is told by its value,
    // both as the method receives them (`crossed`); one whose crossing could
    // run the author's code is taken for a change.
    const NATIVE = /^function (add|delete|clear|set)\(\) \{\s*\[native code\]\s*\}$/;
    const UNCROSSED = Symbol('uncrossed');

    // What the engine hands a native method for a Python argument, when finding
    // it reads nothing of the author's and makes nothing: a scalar of
    // JavaScript's and the engine's null as they are, an `int` past 2⁵³, a
    // `float` and None as the converter gives them (`pyobj2jsobj`), a
    // JavaScript object as itself. A `float` is an object of the engine's, and
    // an `int` past 2⁵³ another, so a key or a value of either, set again as it
    // was read, looked new.
    //
    // Anything else of Python's crosses as the engine's hook makes it
    // (`pyobj2jsobj_hook`), in its order: a callable as the function published
    // for it, told by `crossesAs`, bytes as a copy, made anew, and a list, a
    // dict, a set or an instance as its view, the one `viewOf` keeps, read
    // here and not made. A JavaScript array crosses as a copy.
    const crossed = (one) => {
        if (one === null || (typeof one !== 'object' && typeof one !== 'function')) return one;
        if (typeof one === 'object' && javascriptOwn(one) && !Array.isArray(one)) return one;

        const type = quietPyType(one);

        if (type === _b_.float || type === _b_.int || one === NONE) return $B.pyobj2jsobj(one);
        if (type === undefined || callable(one) || pyBytes(one)) return UNCROSSED;

        return VIEW_OF.get(one) ?? UNCROSSED;
    };

    // Whether `one` crosses as `stored`, what a map holds: a callable as the
    // function published for it (`PUBLISHED`), which `pyHandler` hands again
    // for the same callable, and anything else as `crossed` tells.
    const crossesAs = (one, stored) => {
        if (typeof stored === 'function' && PUBLISHED.get(stored) === one) return true;

        const native = crossed(one);

        return native !== UNCROSSED && native === stored;
    };

    const holds = (proto, obj) => {
        try {
            proto.has.call(obj);
            return true;
        } catch {
            return false;
        }
    };

    const nativeChange = (method, obj, [key, value]) => {
        const name = NATIVE.exec(Function.prototype.toString.call(method.$js_func ?? method))?.[1];
        const proto = holds(Set.prototype, obj) ? Set.prototype : holds(Map.prototype, obj) ? Map.prototype : null;

        if (name === undefined || proto === null || name === (proto === Set.prototype ? 'set' : 'add')) return null;

        const native = name === 'set' ? crossed(key) : undefined;

        if (native === UNCROSSED) return null;

        // A key the map holds, set again: changed unless to the value it holds.
        if (name === 'set' && Map.prototype.has.call(obj, native)) {
            const same = crossesAs(value, Map.prototype.get.call(obj, native));

            return () => !same;
        }

        const size = Reflect.get(proto, 'size', obj);

        return () => Reflect.get(proto, 'size', obj) !== size;
    };

    const jsMutator = (obj, method) => {
        const wrappers = JS_WRAPPERS.get(obj) ?? JS_WRAPPERS.set(obj, new WeakMap()).get(obj);

        if (!wrappers.has(method)) {
            const notified = function (...args) {
                const changed = nativeChange(method, obj, args);
                const saved = saving(obj);
                let result;

                try {
                    result = Reflect.apply(method, this, args);
                    return result;
                } finally {
                    if (changed === null || changed(result)) settle(obj, saved, () => notify(obj));
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
    //
    // Untracked: a function the template calls, or a derived, raises and
    // catches an exception the script keeps as an ordinary part of reading,
    // and the engine's writes on it are no write of the author's, which
    // Svelte refuses during a read (`state_unsafe_mutation`). The page that
    // shows the exception is told all the same.
    for (const name of ['$raise', 'set_exc']) {
        const engine = $B[name];

        $B[name] = function (exc, ...rest) {
            try {
                return Reflect.apply(engine, this, [exc, ...rest]);
            } finally {
                host.untrack(() => notify(exc));
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
        // and what replaces it is a write of the name. The descriptor that
        // computed it is asked of what the class holds, whatever it handed
        // back, a function or a bound method included.
        if (holder !== undefined) {
            if (!callable(result)) linked(nameMarker(holder, attr), holder, result, undefined, true, attr);
            heldDescriptor(holder, attr);
        }

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
                if (found.descriptor) heldDescriptor(cls, attr);
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
        if (typeof attr !== 'string' || !host.reacting()) return undefined;

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

        if (type !== undefined && authoredClass(type) && !MARKS.has(obj)) {
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

        if (markers === undefined) {
            NAME_MARKERS.set(cls, (markers = new Map()));
            READ_CLASSES.add(cls);
        }

        let marker = markers.get(attr);

        // The class is held weakly here: a value that outlives it, a list
        // the module shares, keeps this marker among its parents.
        if (marker === undefined) {
            const target = new WeakRef(cls);

            marker = { stamp: 0, bumps: [() => target.deref() && classNameChanged(target.deref(), attr)], reads: [], target };
            markers.set(attr, marker);
        }

        return marker;
    };

    // What the name holds when the read does not hand it back: a descriptor of
    // the author's, whose `__get__` computes the value read from what it holds.
    // Linked under the name as a value the class holds is, so changing its
    // state, `Row.value.n = 1`, wakes what read the name, as appending to a
    // list the class holds does. Found in the dictionary, with no `__get__` run
    // again; a builtin one, a function or a `property`, holds nothing that
    // changes.
    const heldDescriptor = (cls, attr) => {
        const stored = $B.search_in_dict(cls, attr, $B.NULL);
        const type = stored === $B.NULL ? undefined : quietPyType(stored);

        if (type === undefined || !authoredClass(type)) return;
        if ($B.search_slot(type, 'tp_descr_get', $B.NULL) === $B.NULL) return;

        linked(nameMarker(cls, attr), cls, stored, undefined, true, attr);
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

    // And on the special methods a metaclass gives the classes it makes,
    // `PROTOCOLS`, which an operation on a class looks up and no read names:
    // `Subject()`, `len(Subject)`, `for row in Subject`. A reaction that reads
    // a declared class follows them, through every metaclass of the author's
    // the class is looked up through (`followMetaclass`).
    const PROTOCOLS = Symbol('special methods');

    followMetaclass = (value) => {
        if (!host.reacting()) return;

        const meta = pyClass(value) ? quietPyType(value) : undefined;

        if (meta === undefined || !authoredClass(meta)) return;

        for (const cls of meta.tp_mro) if (authoredClass(cls)) className(cls, PROTOCOLS).subscribe();
    };

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

        if (names === undefined) {
            CLASS_NAMES.set(cls, (names = new Map()));
            READ_CLASSES.add(cls);
        }

        let entry = names.get(attr);

        if (entry === undefined) {
            const updates = new Set();

            entry = {
                updates,
                subscribe: host.subscriber((update) => {
                    updates.add(update);
                    return () => updates.delete(update);
                })
            };
            names.set(attr, entry);
        }

        return entry;
    };

    // A write made while the template renders wakes the readers too, and Svelte
    // refuses it there, `state_unsafe_mutation`, as it refuses a write to its
    // own state: a reader already painted is never left showing the old value.
    const classNameChanged = (cls, attr) => {
        // A class nothing reads has nothing to tell (`READ_CLASSES`), and an
        // object that is no class is not one of them: one lookup, since every
        // attribute write of the program comes through here.
        if (typeof attr !== 'string' || !READ_CLASSES.has(cls)) return;

        // The value the name held is asked again the next time a mutation of
        // it climbs to the name (`attributeHolds`), as a container's links are
        // once the container itself has changed.
        const marker = NAME_MARKERS.get(cls)?.get(attr);

        if (marker !== undefined) marker.stamp = ++changes;

        const names = CLASS_NAMES.get(cls);

        // New bases are a new lookup for every name read through the class,
        // or through a subclass or an instance of it, all of which followed
        // the name on it: `C.__bases__ = (B,)` wakes them all.
        const woken =
            attr === '__bases__'
                ? [...(names?.values() ?? [])]
                : [names?.get(attr), names?.get(EVERY), /^__.+__$/.test(attr) ? names?.get(PROTOCOLS) : undefined];

        for (const update of woken.flatMap((entry) => [...(entry?.updates ?? [])])) update();

        // A special method is looked up by an operation, `len(box)`,
        // `box()`, `for row in box`, or by a name's fallback,
        // `__getattr__`, none of which reads it by its name: given anew, it
        // wakes the readers of every watched object it answers for. New bases
        // enrol them under the classes they are looked up through now.
        if (attr === '__bases__') for (const one of cls.tp_mro) enrolClass(one);
        if (/^__.+__$/.test(attr)) wakeInstances(cls);
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
        if (typeof attr !== 'string' || !host.reacting()) return null;

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
        //
        // A watched dict's write is told as its own `__setitem__` is
        // (`changeOf`), a dict's alone: the class of any other may write it
        // anywhere. Asked of a watched object only, the copy too, since every
        // write by subscript in the program comes through here.
        const watched = MARKS.has(obj);
        const dict = watched && quietPyType(obj) === _b_.dict;
        const changed = dict ? changeOf('__setitem__', obj, [key, value]) : null;
        const saved = !watched ? undefined : dict ? saving(obj, '__setitem__', [key, value]) : saving(obj);

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
                if (changed === null || changed()) settle(obj, saved, () => MARKS.get(obj)());
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
        // and nothing puts it back. A dict's is told as the write above.
        const changed = MARKS.has(obj) && quietPyType(obj) === _b_.dict ? changeOf('__delitem__', obj, rest) : null;
        const saved = saving(obj);

        try {
            return delitem(obj, ...rest);
        } finally {
            if (changed === null || changed()) settle(obj, saved, () => notify(obj));
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
            beforeClassWrite(obj, attr);

            const saved = saving(obj);
            let result;

            try {
                result = setattr(obj, attr, value, ...rest);
                return result;
            } finally {
                settle(obj, saved, () => {
                    classNameChanged(obj, attr);

                    if (MARKS.has(obj)) {
                        // What the write *stored*, and not only what it was
                        // handed: a `__setattr__` of the author's may normalise,
                        // copy or wrap its argument, `object.__setattr__(self,
                        // name, list(value))` being an ordinary way to defend an
                        // invariant, and the list the object holds is the one
                        // the page reads.
                        //
                        // Read off the instance's own storage, never through
                        // `$getattr`: a property of the author's must not run
                        // because something was written.
                        rewalk(obj, value, attr);
                        MARKS.get(obj)();
                    }
                });
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
                const saved = saving(obj);

                try {
                    return built(self, obj, ...value);
                } finally {
                    if (MARKS.has(obj)) {
                        settle(obj, saved, () => {
                            if (value.length > 0) rewalk(obj, value[0]);
                            MARKS.get(obj)();
                        });
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
        beforeClassWrite(obj, attr);

        const saved = saving(obj);

        try {
            return Reflect.apply(delattr, this, arguments);
        } finally {
            settle(obj, saved, () => {
                classNameChanged(obj, attr);
                notify(obj);
            });
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
        const saved = saving(left);
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
                settle(left, saved, () => {
                    adopt(left);
                    MARKS.get(left)();
                });
            }

            throw error;
        }

        if (result === left && watched) {
            // `rows += [[]]` puts the new rows under watch, and `rows +=
            // items()` cannot: the generator kept nothing, and neither does a
            // class whose `__iter__` makes its rows as it goes. The same two answers
            // as the method paths above, and the same question decides.
            settle(left, saved, () => {
                if (!keeps(right) || !inheritContents(left, right)) adopt(left);

                MARKS.get(left)();
            });
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
export const watchable = (value) => value !== null && (typeof value === 'object' || pyFunction(value));

// A tuple changes only through what it holds: one holding nothing that can
// change, `(0, 0)` or `("a", (1, 2))`, has nothing to watch. Watched, it
// gathered as parents every container it was put in, which each read of it
// climbed: an option value shared by a thousand rows cost a thousand links per
// read. Asked once of each tuple, whose items never change. A subclass may
// hold attributes, and is watched as an instance is.
const STILL_TUPLES = new WeakMap();

function stillTuple(value) {
    if (!isTuple(value)) return false;

    let still = STILL_TUPLES.get(value);

    if (still === undefined) {
        still = !value.some(mutable);
        STILL_TUPLES.set(value, still);
    }

    return still;
}

// A frozenset changes no more than a tuple does, through what it holds, and one
// holding nothing that can change has nothing to watch: no marker, and so no
// weak reference keeping it, and all a job makes of them, alive until the job
// ends. Asked once of each, whose members never change. A subclass may hold
// attributes, and is watched as an instance is.
const STILL_FROZENSETS = new WeakMap();

function stillFrozenset(value) {
    let still = STILL_FROZENSETS.get(value);

    if (still === undefined) {
        still = !Object.values(value.$store).flat().some(mutable);
        STILL_FROZENSETS.set(value, still);
    }

    return still;
}

// The engine's values that never change, which Brython keeps as objects: a
// float, an int too large for a number, a string out of the BMP, bytes, a
// complex, a range, a slice. Of these very types, and not of a subclass, which
// may hold attributes: nothing to watch.
const STILL_TYPES = new Set([_b_.float, _b_.int, _b_.str, _b_.bytes, _b_.complex, _b_.range, _b_.slice]);

// What an object stores, copied deep enough to put it back (`settle` in the
// mutation tracking): its own fields, each as its descriptor and in its order,
// so that no getter runs to copy one, a hole stays a hole, and a key put back
// takes its place again; the attribute dict any object of Python's may carry,
// the same way; and the entries of a `Map` or a `Set` of JavaScript's, which
// no descriptor holds. The values are the author's and kept as they are, and
// so is whatever the engine keeps beside them, the class a dict names among
// them. A table the engine changes in place is put back in place, its fields
// the same way, and so are the arrays a table of fields holds: a dict's
// tables, a set's buckets, a bytearray's bytes and a function's `__name__`,
// `__doc__` and `__defaults__`.
const TABLES = ['TABLE', 'KEYS', 'VALUES', 'HASHES'];

const inPlace = (obj, key) => {
    if (isSet(obj)) return key === '$store';
    if (key === 'source') return ownType(obj)?.tp_mro.includes(_b_.bytearray) === true;

    return key === '$function_infos' || key === '$infos' || (typeof key === 'symbol' && TABLES.includes(key.description) && globalThis.__BRYTHON__.is_dict(obj));
};

// Each field as `[key, descriptor]`, and a table's with its own fields after.
const fieldsOf = (obj, table = false) =>
    Reflect.ownKeys(obj).map((key) => {
        const held = Object.getOwnPropertyDescriptor(obj, key);
        const value = held.value;
        const holds = value !== null && typeof value === 'object' && (table ? !Array.isArray(obj) && Array.isArray(value) : inPlace(obj, key));

        return holds ? [key, held, fieldsOf(value, true)] : [key, held];
    });

const DESCRIBED = ['value', 'get', 'set', 'writable', 'enumerable', 'configurable'];

// Fields put back as they were, each by its descriptor: one added since goes,
// one gone comes back, one changed takes its own again, and from the first one
// out of its place on, each is defined again in turn, so that they come back in
// the order they had. A field that cannot be redefined, an array's length, is
// written.
const fieldsBack = (target, fields) => {
    const kept = new Set(fields.map(([key]) => key));

    for (const key of Reflect.ownKeys(target)) {
        if (!kept.has(key) && Object.getOwnPropertyDescriptor(target, key).configurable) delete target[key];
    }

    const order = Reflect.ownKeys(target);
    let moved = false;

    fields.forEach(([key, held, inner], at) => {
        const now = Object.getOwnPropertyDescriptor(target, key);

        moved ||= order[at] !== key;

        if (now === undefined || (moved && now.configurable) || !DESCRIBED.every((one) => Object.is(now[one], held[one]))) {
            if (now === undefined || now.configurable) {
                if (now !== undefined && moved) delete target[key];
                Object.defineProperty(target, key, held);
            } else if (now.writable && 'value' in held) {
                target[key] = held.value;
            }
        }

        if (inner !== undefined) fieldsBack(held.value, inner);
    });
};

const nativeHolds = (proto, obj) => {
    try {
        proto.has.call(obj);
        return true;
    } catch {
        return false;
    }
};

function storageOf(target) {
    const $B = globalThis.__BRYTHON__;
    const attributes = ownAttributes(target);
    const saved = { fields: fieldsOf(target), attributes: $B.is_dict(attributes) ? fieldsOf(attributes) : undefined };

    if (nativeHolds(Map.prototype, target)) saved.map = [...Map.prototype.entries.call(target)];
    else if (nativeHolds(Set.prototype, target)) saved.set = [...Set.prototype.values.call(target)];

    return saved;
}

function putBack(target, saved) {
    if (saved.map !== undefined) {
        Map.prototype.clear.call(target);
        for (const [key, value] of saved.map) Map.prototype.set.call(target, key, value);
    } else if (saved.set !== undefined) {
        Set.prototype.clear.call(target);
        for (const one of saved.set) Set.prototype.add.call(target, one);
    }

    fieldsBack(target, saved.fields);

    if (saved.attributes !== undefined) fieldsBack(ownAttributes(target), saved.attributes);
}

// Only a container can be mutated in place; a scalar propagates by rebinding,
// which the accessor already handles.
function mutable(value) {
    if (pyFunction(value)) return true;
    if (value === null || value === undefined || typeof value !== 'object') return false;
    if (Array.isArray(value)) return !stillTuple(value); // list, and a tuple is one too
    if (value === NONE) return false; // a singleton shared by the whole program

    try {
        const $B = globalThis.__BRYTHON__;
        const cls = $B.get_class(value);
        // A class is data when the author wrote it: it keeps its attributes in
        // a dictionary, as a function and an instance do, and `Counter.total +=
        // 1` is state. CPython flags such a class a heap type, and so does
        // Brython; the engine's own classes have nothing to watch.
        if (cls === _b_.type) return authoredClass(value);

        if (STILL_TYPES.has(cls)) return false;
        if (cls === _b_.frozenset) return !stillFrozenset(value);

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
const upwards = (start, stamp) => {
    if (start.seen === stamp) return;
    start.seen = stamp;

    for (const one of start.bumps) one();

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
                detach(marker);
            }
            frame.climbed = null;
        }

        if (--frame.at < 0) {
            frames.pop();
            continue;
        }

        const parent = parents[frame.at];
        const holder = targetOf(parent);
        const known = verified.get(parent) === parent.stamp;

        if (holder === undefined || (child !== undefined && !known && !holds(holder, child, marker))) {
            marker.linked.delete(parent);
            parents.splice(frame.at, 1);
            detach(marker);
            continue;
        }

        verified.set(parent, parent.stamp);
        frame.climbed = parent;

        if (parent.seen === stamp) continue;
        parent.seen = stamp;

        for (const one of parent.bumps) one();

        if (parent.parents !== undefined) frames.push(climbing(parent));
    }
};

// A link found to hold stays found until its parent changes: a dict of rows
// whose rows are each updated would otherwise read every entry of the dict once
// per row.
const climbing = (marker) => ({
    marker,
    child: targetOf(marker),
    verified: (marker.verified ??= new WeakMap()),
    at: marker.parents.length,
    climbed: null
});

const dead = (marker) => marker.bumps.length === 0 && (marker.parents === undefined || marker.parents.length === 0);

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
        kind.tp_mro.some((one) => authoredClass(one) && $B.search_in_dict(one, hook, $B.NULL) !== $B.NULL);

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
export const MARKS = new WeakMap();

// `walk` false leaves what the value holds to the caller, which takes it under
// watch once the value's own link is made (`linked`).
export function mark(value, walk = true) {
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

        upwards(marker, ++walked);
    };

    marker.stamp = 0;

    marker.bumps = [];
    // Held while something reads it or a watched container holds it, and let
    // go when neither does (`detach`): a child's link then no longer keeps a
    // container it has left alive. A weak reference instead, made for every
    // value marked, kept each one alive until the job that made it ended.
    marker.held = value;

    MARKS.set(value, marker);

    if (pyClass(value)) READ_CLASSES.add(value);

    enrol(value);
    if (walk) adopt(value);

    return marker;
}

// What a marker stands for: the value it holds, undefined once let go; or, for
// the marker of a name of a class, the class its weak reference still reaches.
const targetOf = (marker) => marker.held ?? marker.target?.deref();

// A marker nothing reads and no watched container holds lets its value go: a
// child that left the value, kept somewhere, keeps it no more, and its link to
// it goes at the child's next change (`upwards`). Read again or held again, the
// marker takes its value back, and what the value holds with it (`track`,
// `linked`, `follow`). A child that left a row it was in keeps that row, and
// what the row is in up to the first value let go, until the child changes.
const detach = (marker) => {
    if (dead(marker)) marker.held = undefined;
};

// The classes of the author's an object marked is looked up through, which
// something may now read (`READ_CLASSES`): a write to one is asked about. New
// bases are new classes looked up through, for the objects of a class and of
// its subclasses alike (`classNameChanged`).
const enrolClass = (cls) => {
    if (authoredClass(cls)) READ_CLASSES.add(cls);
};

function enrol(value) {
    for (const cls of quietPyType(value)?.tp_mro ?? []) enrolClass(cls);
}

// The markers something reads, each as long as it is read (`join`, `leave`):
// held, as their readers hold their values.
const LIVE = new Set();

// A special method a class is given anew, `Base.__len__ = …`, changes what
// `len()` answers for each of its objects, and for each of its subclasses',
// and the read that called it read no name (`classNameChanged`): it wakes the
// readers of each watched object looked up through the class now, found
// under what something reads (`LIVE`), the way `adopt` walks a value. An object
// that left the class, by new bases or by a new `__class__`, is not one of
// them. A list of every object watched under its class answered without a
// walk, and the weak reference each entry took kept every object a loop made
// alive until the job ended, for a write that comes rarely.
function wakeInstances(cls) {
    const seen = new Set();
    const pending = [...LIVE].map(targetOf);

    while (pending.length > 0) {
        const value = pending.pop();
        const marker = value === undefined || seen.has(value) ? undefined : MARKS.get(value);

        if (marker === undefined) continue;
        seen.add(value);

        if ((quietPyType(value)?.tp_mro ?? []).includes(cls)) marker();

        pending.push(...watchedParts(value));
    }
}

// What a watched value holds that is watched under it, as `adopt` finds it:
// its attribute dictionary and its slots, the items of a list, both halves of
// a dict's entries, a set's members, what a live view reads.
function watchedParts(value) {
    const parts = [];
    const attributes = ownAttributes(value);

    if (attributes !== undefined) parts.push(attributes);
    parts.push(...slotValues(value, true));

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            const held = Object.getOwnPropertyDescriptor(value, i);

            if (held !== undefined && 'value' in held) parts.push(held.value);
        }
    } else if (globalThis.__BRYTHON__.is_dict(value)) {
        for (const [key, child] of heldEntries(value)) parts.push(key, child);
    } else if (isSet(value)) {
        for (const bucket of Object.values(value.$store)) parts.push(...bucket);
    } else if (viewed(value) !== undefined) {
        parts.push(viewed(value));
    }

    return parts.filter((one) => MARKS.has(one));
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
        // A JavaScript array may hold an element behind a getter, the author's
        // code, which watching must not run: read by its descriptor, a value
        // held is watched now and a getter's result when Python reads it
        // (`$getitem`). A list holds values alone, and is read as stored.
        if (ownType(value) === undefined) {
            for (let i = 0; i < value.length; i++) {
                const held = Object.getOwnPropertyDescriptor(value, i);

                if (held !== undefined && 'value' in held) inherit(value, held.value, i);
            }
        } else {
            for (let i = 0; i < value.length; i++) inherit(value, value[i], i);
        }
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
const join = (marker, bump, owner) => {
    if (marker.bumps.includes(bump)) return;

    marker.bumps.push(bump);
    LIVE.add(marker);

    if (owner !== undefined) owner.push(marker, bump);
};

// Sign the same subscriber off one marker: a name rebound no longer reads what
// it held. Other names on that object keep their own subscribers.
const leave = (marker, bump, owner) => {
    const at = marker.bumps.indexOf(bump);
    if (at === -1) return;

    marker.bumps.splice(at, 1);
    if (marker.bumps.length === 0) LIVE.delete(marker);
    detach(marker);

    if (owner === undefined) return;

    for (let i = 0; i < owner.length; i += 2) {
        if (owner[i] === marker && owner[i + 1] === bump) {
            owner.splice(i, 2);
            return;
        }
    }
};

// Every marker a component signed onto, and the callback it signed with, kept
// flat rather than in pairs so that subscribing allocates nothing.
//
// Without this, a container shared through a store would keep the callbacks of
// every component that ever read it, one more per mount of a child, for one
// child alive.
export function unsubscribe(owner) {
    for (let i = 0; i < owner.length; i += 2) leave(owner[i], owner[i + 1]);

    owner.length = 0;
}

// What the name held before this write loses its subscription, or a mutation of
// a value the name no longer holds would still notify it. Kept on the name's
// `bump` rather than read off the name: that is a signal, and reading it inside
// an effect that writes the name would subscribe the effect to it.
export function track(value, bump, owner) {
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
        // children, pruned as a dead end, and let its value go: listened to
        // again, it takes both back.
        const revived = dead(own);
        own.held = value;
        join(own, bump, owner);
        if (revived) adopt(value);
        return value;
    }

    if (!mutable(value)) return value;

    // A frozen object refuses the marker and comes back without one.
    const marker = mark(value);

    if (marker !== undefined) join(marker, bump, owner);

    return value;
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

export function inherit(parent, child, key, loose = false, name = undefined) {
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
        // What the child holds is taken under watch once its own link is made,
        // below: a row's link to its list is what tells the row it is held.
        own = mark(child, false);

        // A frozen object refuses the marker, and `mark` says so by giving the
        // value back unchanged.
        if (own === undefined) return child;
        revived = true;
    } else {
        // A dead end, pruned by `upwards`, whose own children may have lost
        // their link to it the same way: linked again, it takes them back.
        revived = dead(own);
    }

    // Held by a watched container, the child holds its value again.
    own.held = child;

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
                if (targetOf(one) === undefined) own.linked.delete(one);
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

// Subscribe the caller to the value it is being handed: to a change of the
// value or of anything under it, and to nothing else.
//
// Every other accessor reads the revision of its own name, which is enough. A
// value handed over is not: a row of an `{#each}` and a snippet's parameter are
// plain JavaScript values, not signals, and a `@derived` is memoised on `===`,
// so one that returns the very object it was given propagates nothing when that
// object is mutated in place. Reading the value's own revision re-establishes
// the chain at the far end, where the reader is.
//
// The value's, and not the revision of a name above it: through the name, a
// change in one row reached what read every other row, as Svelte's per-object
// signals do not, and a thousand bound selects, each written as it mounts, read
// each other a thousand times.
export function follow(value) {
    if (watchable(value)) {
        // A value a block declares comes under watch when it is first read.
        const marker = MARKS.get(value) ?? (BLOCK_STATE.has(value) && mutable(value) ? mark(value) : undefined);

        // Held again before the watch signs on, which it does there and then,
        // and takes back what the value holds.
        if (marker !== undefined) {
            marker.held = value;
            (marker.watch ??= watcher(marker))();
        }
    }

    return value;
}

// A value's own revision, signed onto its marker while something reads it and
// off it when nothing does, so a container nobody reads stays a dead end. A
// marker left as one may have lost the links from its children, and takes them
// back as it is read again.
const watcher = (marker) =>
    host.subscriber((update) => {
        const revived = dead(marker);

        join(marker, update);
        if (revived) adopt(targetOf(marker));

        return () => leave(marker, update);
    });

// The Python callable each function `pyHandler` published stands for, so that
// what comes back to Python is the callable it handed over, through every door:
// a context, a write into a view, a set asked whether it holds it, and the
// engine's own conversion (`PYOBJ_MAP`). Back as its wrapper, a function read
// out of a set was not in it, and added again was a second member.
export const PUBLISHED = new WeakMap();

// What a lookup finds where nothing is, no member, no key, no attribute: told
// apart from every value Python can hold, `None` included.
export const MISSING = Symbol('bryntime.missing');

// What each namespace's accessors read a name at, as stored, with no
// conversion and no computation, by the prototype they sit on: where the
// accessor's getter does either, a prop's number made a float, a derived's body
// run. It is what `del` watches; without one, the getter is it.
export const STORED = new WeakMap();

// What a namespace holds under `name`, asked at its source: a derived's
// definition and not its value, so a question about a name, `del`, the keys of
// `globals()` or what a failed module keeps, runs no computation. `undefined`
// when it holds nothing.
export const heldAtSource = (namespace, name) => {
    if (Object.hasOwn(namespace, name)) return namespace[name];

    const proto = Object.getPrototypeOf(namespace);
    const accessor = proto === null ? undefined : Object.getOwnPropertyDescriptor(proto, name);

    if (accessor === undefined) return undefined;

    const source = STORED.get(proto)?.get(name) ?? accessor.get;

    return source === undefined ? accessor.value : source.call(namespace);
};

// Each dict that stands for a namespace, the one `globals()` hands out, to the
// namespace it is a view of.
export const NAMESPACE_DICTS = new WeakMap();

// The entries a watch walks, which hands the watch to what a mapping holds: a
// namespace's names as held at their source, a derived's definition and not
// its value, which watching has no reason to compute; any other dict's own.
// A module a watched value reaches, a list of modules or one imported into a
// reactive module, was walked through its values, and every derived of it was
// run, read or not.
export const heldEntries = (value) => {
    const namespace = NAMESPACE_DICTS.get(value);

    return namespace === undefined ? pyEntries(value) : Object.keys(value).map((key) => [key, heldAtSource(namespace, key)]);
};
