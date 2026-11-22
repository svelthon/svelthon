// SvelteKit's `transport` for what Python hands the browser: the data of a
// `load()`, an action's answer, a streamed result, a remote function's. Each
// crosses as pickle carries a value from one process to another (Bryntime's
// `pickled`), and comes out a Python value of the same type, its sharing and
// its cycles kept, an instance of the class it was; JavaScript reads it through
// its views, as a prop a Python parent hands it.
//
// The plugin installs it with no file of the author's: around SvelteKit's
// `init_transport` on the server, and into the hooks of the client's manifest,
// before the application's own transporters.
//
// It imports no engine: a page written in JavaScript alone loads none. The
// bridge, which every Python module loads, registers the codec under a key
// both reach (`CODEC`). What cannot be rebuilt yet, before the engine or before
// the module of a class it names has loaded, is JavaScript's copy of the same
// forms, which Python reads, at its first read, as the value rebuilt then.
const CODEC = Symbol.for('svelthon.codec');
const codec = () => globalThis[CODEC];

// What this module keeps is kept under a key of the global too: the client's
// manifest imports this file by its path and the bridge by its own, and a
// bundler that pre-bundles the bridge makes two of it.
const SHARED = (globalThis[Symbol.for('svelthon.transport')] ??= { origins: new WeakSet(), pending: new Set() });

// The data of a `load()` at the top, where SvelteKit wants a plain object and
// merges a layout's into its page's with a spread: each one carries, under a
// symbol of its own that the spread copies, where its values came from, read
// back by a Python page's `data` (`origins`).
const ORIGINS = SHARED.origins;

export const markTop = (pojo, origin) => {
    ORIGINS.add(origin);
    SHARED.marked = true;
    Object.defineProperty(pojo, Symbol('svelthon.load'), { value: origin, enumerable: true, configurable: true, writable: true });

    return pojo;
};

// The origins a merged `data` holds, its nodes' in the order SvelteKit merged
// them; none, and nothing looked at, before any data was marked.
export const origins = (data) =>
    SHARED.marked !== true
        ? []
        : Object.getOwnPropertySymbols(data)
              .map((key) => Object.getOwnPropertyDescriptor(data, key)?.value)
              .filter((one) => ORIGINS.has(one));

const encode = (thing) => {
    if (thing === null || (typeof thing !== 'object' && typeof thing !== 'function')) return undefined;

    return codec()?.encode(thing);
};

// The objects JavaScript reads that Python reads as a value rebuilt at its
// first read, kept until the codec is there (`codecLoaded`), and no longer
// than the page holds them: a page left lets its data go, the codec there or
// not.
const PENDING = SHARED.pending;
const LET_GO = (SHARED.letGo ??= new FinalizationRegistry((entry) => PENDING.delete(entry)));

const adopt = (object, python) => {
    let value;
    const once = () => (value ??= { made: python() }).made;
    const found = codec();

    if (found !== undefined) {
        found.adopt(object, once);
        return;
    }

    const entry = { object: new WeakRef(object), once };

    PENDING.add(entry);
    LET_GO.register(object, entry);
};

export const codecLoaded = () => {
    const found = codec();
    const entries = [...PENDING];

    PENDING.clear();
    for (const { object, once } of entries) {
        const held = object.deref();

        if (held !== undefined) found.adopt(held, once);
    }
};

// A dict at the top of what crossed, the data of a `load()`, an action's answer,
// a remote function's: the plain object SvelteKit and JavaScript read, its
// values made at the first read, once SvelteKit has loaded the page's modules,
// which the classes the data names belong to; and the dict Python reads. The
// data of a `load()` its server marked says where its values came from.
function top(names, dict, marked, trusted) {
    let made;
    let rebuilt;
    const resolve = () => (made ??= codec()?.decodeTop(names, dict, true, trusted) ?? copiedTop(dict, (at) => python().entries()[at][2]));
    const pojo = {};
    const getters = names.map((_, at) => () => resolve().value(at));

    // No function made here names `pojo`: it would be kept with every function
    // made here, the one the queue holds until the codec loads among them.
    for (const [at, name] of names.entries()) {
        Object.defineProperty(pojo, name, {
            get: getters[at],
            set(value) {
                Object.defineProperty(this, name, { value, writable: true, enumerable: true, configurable: true });
            },
            enumerable: true,
            configurable: true
        });
    }

    // JavaScript may have read the copies, and written over the plain object;
    // Python reads the dict, with what JavaScript left there at its first read.
    const python = () => (rebuilt ??= resolve().dict === undefined ? codec().decodeTop(names, dict, false, trusted) : resolve());
    const left = new WeakRef(pojo);

    adopt(pojo, () => python().dict(edits(left.deref(), names, getters)));

    // Each entry as JavaScript read it, a copy among them, which SvelteKit's
    // merge holds.
    const entries = () => python().entries().map(([name, key, value], at) => [name, key, value, resolve().value(at)]);

    return marked ? markTop(pojo, { entries }) : pojo;
}

// What JavaScript left of a top's plain object, as SvelteKit's merge is read
// (`routeData`): for each entry, nothing while its own getter still reads it,
// `{ value }` for one JavaScript wrote, null for one it deleted; and the names
// it added, with their values.
const edits = (object, names, getters) => ({
    entries: names.map((name, at) => {
        const own = Object.getOwnPropertyDescriptor(object, name);

        return own === undefined ? null : own.get === getters[at] ? undefined : { value: object[name] };
    }),
    added: Object.keys(object)
        .filter((name) => !names.includes(name))
        .map((name) => [name, object[name]])
});

// `trusted` for what the server reads back under its own signature
// (`transport-server.js`): rebuilt in full, where anything else it reads came
// from the browser for all it knows. The browser reads a signature as nothing.
const decode = (made, trusted = false) => {
    if (Array.isArray(made) && made[0] === 'k') return decode(made[1]);
    if (Array.isArray(made) && made[0] === 'p') return top(made[1], made[2], made[3] === 1, trusted);

    const found = codec();
    const value = found?.decode(made, true, trusted);

    if (found !== undefined && value !== found.UNLOADED) return value;
    if (Array.isArray(made) && made[0] === 'J') return copiedGroup(made, trusted);

    const copy = copied(made, new Map());

    if (copy !== null && typeof copy === 'object') adopt(copy, () => codec().decodeValue(made, false, trusted));

    return copy;
};

// A group (`'J'`) read before its values can be rebuilt: its shape around their
// copies, each of which Python reads, at its first read, as the value rebuilt
// then, as a top's dict is.
function copiedGroup(made, trusted) {
    const values = copied(made[2], new Map());
    const copies = Array.isArray(values) ? values : [];
    let rebuiltValues;
    const python = () => (rebuiltValues ??= [...codec().decodeValue(made[2], false, trusted)]);

    copies.forEach((one, at) => {
        if (one !== null && typeof one === 'object') adopt(one, () => python()[at]);
    });

    return rebuilt(made[1], copies);
}

export const transport = { svelthon: { encode, decode } };

// The application's own `transport`, which the plugin hands here, on the server
// as SvelteKit starts it and in the browser as its manifest loads
// (`svelthon.js`): a container of JavaScript's among Python values that one of
// its transporters writes crosses as what its `encode` makes of it, shaped with
// those values, and is made again by its `decode` (`rebuilt`).
export const applicationTransport = (given) => {
    SHARED.application = Object.entries(given).filter(([key]) => key !== 'svelthon');

    return given;
};

export const transporters = () => SHARED.application ?? [];

// A JavaScript server module's `load` (`svelthon.js` wraps it): what it returns
// its page reads on the server as the browser reads it, where it holds Python
// values (the bridge's `crossedData`). With no engine loaded, it holds none.
export const serverLoad = (load) => {
    if (typeof load !== 'function') return load;

    const crossed = (data, event) => codec()?.crossedData(data, event) ?? data;
    const relay = function (...args) {
        const data = load.apply(this, args);

        return data !== null && typeof data?.then === 'function' ? Promise.resolve(data).then((one) => crossed(one, args[0])) : crossed(data, args[0]);
    };

    return Object.defineProperty(relay, 'name', { value: load.name });
};

// A `load` its module may bind again, `let load = first` written over by
// `first` itself, or binds only later: read where it is bound at each call, as
// SvelteKit reads the module's export at each request, and relayed as above. A
// falsy one is skipped, as SvelteKit skips it.
export const liveLoad = (read) => {
    const relays = new WeakMap();

    return function load(...args) {
        const found = read();

        if (!found) return undefined;
        if (typeof found !== 'function') return found.call(this, ...args);
        if (!relays.has(found)) relays.set(found, serverLoad(found));

        return relays.get(found).apply(this, args);
    };
};

// ------------------------------------------------------------ the copies

// What JavaScript reads where nothing Python can be rebuilt yet: the forms a
// view shows it, as copies. None is the absence, a tuple an array, a set a `Set`
// in the order its view walks, bytes a `Uint8Array`, an instance what its view
// shows; a class, a function or a bound method, which only the engine runs, a
// function of its name that says so when called.
function copied(made, memo) {
    if (made === null) return undefined;
    if (!Array.isArray(made)) return made;
    if (memo.has(made)) return memo.get(made);

    const [tag] = made;
    const keep = (value) => (memo.set(made, value), value);
    const each = (from, fill) => {
        for (let at = from; at < made.length; at++) fill(copied(made[at], memo));
    };

    switch (tag) {
        case '=':
        case 'k':
            return copied(made[1], memo);
        case 'p':
            return copied(made[2], memo);
        case 'f':
        case 'j':
            return made[1];
        // A coroutine's result, streamed pickled: the promise of its copy.
        case 'a':
            return keep(Promise.resolve(made[1]).then((structure) => copied(structure, new Map())));
        // One copy for the one complex, wherever it is held, as a list's.
        case 'c':
            return keep(Object.freeze({ real: made[1], imag: made[2] }));
        // A JavaScript shape around the copies of the values it holds.
        case 'J': {
            const values = copied(made[2], memo);

            return keep(rebuilt(made[1], Array.isArray(values) ? values : []));
        }
        // By its name alone: Ellipsis and NotImplemented nothing, as their
        // views, anything else something only the engine runs.
        case 'g':
            return keep(made[1] === 'builtins' && NOTHING.has(made[2]) ? undefined : pythonOnly(made[2]));
        case 'b':
        case 'B':
            return keep(Uint8Array.from(made[1]));
        case 'l':
        case 't': {
            const out = keep([]);

            each(1, (one) => out.push(one));
            return out;
        }
        case 's':
        case 'S': {
            const out = keep(new Set());

            each(1, (one) => out.add(one));
            return out;
        }
        case 'd': {
            const out = keep({});

            for (let at = 1; at < made.length; at += 2) define(out, nameOf(made[at], memo), copied(made[at + 1], memo));
            return out;
        }
        // An instance as its view shows it: a list's or a dict's of its items or
        // its entries, another builtin's subclass the builtin's value its server
        // wrote last (Bryntime's `builtinValue`), any other its attributes.
        case 'n':
        case 'r': {
            const [state, list, entries, plain] = tag === 'n' ? [made[4], made[5], made[6], made[8]] : [made[3], made[4], made[5], made[7]];

            if (plain !== undefined) {
                const value = copied(plain, memo);

                memo.set(made, value);
                return value;
            }

            if (Array.isArray(list)) {
                const out = keep([]);

                for (const one of list) out.push(copied(one, memo));
                return out;
            }

            const out = keep({});

            if (Array.isArray(entries)) {
                for (let at = 0; at < entries.length; at += 2) define(out, nameOf(entries[at], memo), copied(entries[at + 1], memo));
                return out;
            }

            // Its attributes: its state, a dict, or the pair an instance with
            // slots hands, its dict and its slots.
            const parts = Array.isArray(state) && state[0] === 't' ? state.slice(1) : [state];

            for (const part of parts) {
                if (Array.isArray(part) && part[0] === 'd') {
                    for (const [name, value] of Object.entries(copied(part, memo))) define(out, name, value);
                }
            }
            return out;
        }
    }

    return undefined;
}

const NOTHING = new Set(['Ellipsis', 'NotImplemented']);

// What JavaScript's own containers that held Python values cross as (the
// bridge's `grouped`): each container made again, an array, a Map, a Set, a
// plain object or one with no prototype (`'O'`), each value at its place, a
// JavaScript one itself, and a hole of an array (`'h'`) a hole, which `reduce`
// and `in` tell from `undefined`; one the application's transport writes
// (`'x'`) by its decoder, from what its encoder made of it, made again.
export function rebuilt(node, values, memo = new Map()) {
    if (!Array.isArray(node)) throw malformed();
    if (memo.has(node)) {
        if (memo.get(node) === DECODING) throw circular();
        return memo.get(node);
    }

    const [kind] = node;

    if (kind === 'j') return node[1];
    if (kind === '@') {
        if (!Number.isInteger(node[1]) || node[1] < 0 || node[1] >= values.length) throw malformed();
        return values[node[1]];
    }
    if (kind === 'x') {
        const decode = transporters().find(([key]) => key === node[1])?.[1].decode;

        if (node.length !== 3 || typeof decode !== 'function') throw malformed();
        memo.set(node, DECODING);

        const made = decode(rebuilt(node[2], values, memo));

        memo.set(node, made);
        return made;
    }

    const named = kind === 'o' || kind === 'O';
    const out = kind === 'a' ? [] : kind === 'm' ? new Map() : kind === 's' ? new Set() : kind === 'o' ? {} : kind === 'O' ? Object.create(null) : undefined;

    if (out === undefined || ((named || kind === 'm') && node.length % 2 === 0)) throw malformed();
    memo.set(node, out);

    for (let at = 1; at < node.length; at += named || kind === 'm' ? 2 : 1) {
        if (named && typeof node[at] !== 'string') throw malformed();
        if (kind === 'a' && Array.isArray(node[at]) && node[at].length === 1 && node[at][0] === 'h') {
            out.length += 1;
            continue;
        }

        const one = named ? node[at] : rebuilt(node[at], values, memo);

        if (kind === 'a') out.push(one);
        else if (kind === 's') out.add(one);
        else if (kind === 'm') out.set(one, rebuilt(node[at + 1], values, memo));
        else define(out, one, rebuilt(node[at + 1], values, memo));
    }

    return out;
}

const DECODING = Symbol('svelthon.decoding');

const malformed = () => new TypeError("svelthon — the data holds a malformed 'J' value");

// A cycle through such a value, which devalue refuses too: its decoder would be
// handed the value it is making.
const circular =() => new TypeError("svelthon — the data holds a value the application's transport writes inside itself");

const pythonOnly = (name) =>
    ({
        [name]() {
            throw new TypeError(`svelthon — \`${name}\` is Python's, and this page runs no Python: import the module that defines it in the page that reads this data`);
        }
    })[name];

// An entry as the copy's own property, whatever its name: written by
// assignment, `__proto__` would set the copy's prototype.
const define = (target, name, value) => Object.defineProperty(target, name, { value, writable: true, enumerable: true, configurable: true });

// The name a dict view gives a key (Bryntime's `propertyKey`): what pickle
// names, its qualified name; any other key the string of its JavaScript form,
// the copy's here, None's `undefined`, a tuple's its members' as an array
// writes them.
const nameOf = (key, memo) => (Array.isArray(key) && key[0] === 'g' ? key[2] : String(copied(key, memo)));

// A top read before its values can be rebuilt: the copies of its entries, each
// of which Python reads, at its first read, as the entry rebuilt then, as a
// group's values are (`copiedGroup`).
function copiedTop(dict, held) {
    const memo = new Map();
    const values = [];

    for (let at = 2; at < dict.length; at += 2) values.push(copied(dict[at], memo));

    values.forEach((one, at) => {
        if (one !== null && typeof one === 'object') adopt(one, () => held(at));
    });

    return { value: (at) => values[at] };
}
