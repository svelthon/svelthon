// What every compiled component imports. Bryntime comes first, through its one
// door, the package: it starts the engine, and installs the mutation tracking
// on it, before this module runs.
import * as core from 'bryntime';
import { host as brylters } from 'brylters';
import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import BROWSER from 'esm-env/browser';
import { attributeWrapper, textAttribute } from './attributes.js';
import { markTop, origins, codecLoaded, rebuilt, transporters, liveLoad } from './transport.js';

// Held here as constants of this module: a binding imported is read through the
// module's cell at each use, which the hot paths of a crossing paid.
const {
    NONE,
    pyClass,
    ownType,
    quietPyType,
    pyScalar,
    plainScalar,
    plainObject,
    ownAttributes,
    ownAccessors,
    declares,
    declaresSlots,
    behaves,
    pyContainer,
    pyEntries,
    pyDict,
    readNoted,
    keysNoted,
    pyBytes,
    mutableBytes,
    bytesOut,
    bytesIn,
    isSet,
    isDict,
    isTuple,
    isExactScalar,
    authoredClass,
    pyTruth,
    pyStr,
    pyList,
    pyGetattr,
    pyAttributeError,
    pySetattr,
    pySetitem,
    pyContains,
    pyEquals,
    pyRaise,
    jsMember,
    VIEW_OF,
    VIEWED,
    LIST_VIEW,
    PLAIN_VIEW,
    host,
    lent,
    pyBind,
    pyData,
    entering,
    iterated,
    javascriptOwn,
    ownedByJavascript,
    opaque,
    boxed,
    unboxed,
    rawJSON,
    pyCoroutine,
    pyAwaitable,
    thenable,
    slotValues,
    callDescriptor,
    callable,
    slotDeclared,
    wrapperMethod,
    boundMethod,
    pyItems,
    hasItems,
    unpackedPair,
    pyIterable,
    define,
    crossedAs,
    jsonCopy,
    plainData,
    sequence,
    makesPairs,
    notingPairs,
    propertyKey,
    propertyName,
    twoKeys,
    refused,
    doors,
    toJs,
    toPython,
    // The mutation tracking's, set by it as it loads.
    MARKS,
    MISSING,
    BLOCK_STATE,
    STORED,
    NAMESPACE_DICTS,
    watchable,
    mark,
    inherit,
    follow,
    followOwn,
    shaped,
    SHAPING,
    track,
    trackAlone,
    changesNothing,
    trackEach,
    trackOwns,
    unsubscribe,
    removeFound,
    followMetaclass,
    heldAtSource,
    heldEntries,
    // The errors', the calls' and the views'.
    pyError,
    raisedAgain,
    relayed,
    raised,
    schedule,
    scheduleAsync,
    pyArg,
    pyNumbers,
    listed,
    pyCall,
    pyHandler,
    declared,
    calling,
    identified,
    running,
    nameOf,
    arityNow,
    outbound,
    ADAPTERS,
    standsFor,
    jsCall,
    jsMethod,
    jsMemberValue,
    pyLeading,
    pyExport,
    STALE,
    flushExports,
    viewOf,
    attributed,
    unproxied,
    handOver,
    // The modules'.
    moduleNamespace,
    invoke,
    liveExport,
    registerModule,
    pythonModule,
    withNamespace,
    bind,
    // The protocols'.
    byIndex,
    key,
    javaScriptRow,
    starredEntries,
    lookup,
    subscriptable,
    restOf,
    unpackStarred,
    // pickle's.
    pickled,
    unpickled,
    roundTrip,
    statePrint,
    pickleNode,
    isPlainDict,
    readBack,
    listedNow,
    readsAsPython,
    handedAs,
    standsForPython
} = core;

export {
    restOf,
    unpackStarred,
    invoke,
    liveExport,
    registerModule,
    pythonModule,
    withNamespace,
    bind,
    follow,
    followOwn,
    SHAPING,
    track,
    changesNothing,
    unsubscribe,
    pyError,
    schedule,
    scheduleAsync,
    pyArg,
    pyNumbers,
    pyCall,
    pyHandler,
    jsCall,
    pyExport,
    unproxied,
    handOver,
    NONE,
    pyClass,
    ownType,
    pyScalar,
    plainScalar,
    plainObject,
    pyEntries,
    pyBytes,
    isSet,
    isDict,
    pyBind,
    pyData,
    opaque,
    boxed,
    unboxed,
    rawJSON,
    pyCoroutine,
    pyAwaitable,
    thenable,
    callable,
    pyItems,
    hasItems,
    unpackedPair,
    pyIterable,
    jsonCopy,
    plainData
};

export { refusal, pyTypeName, keywordsOf, parseKeywords, pyJsonParse } from 'bryntime';

// The name this project's author knows, which signs every refusal the crossing
// makes, as every other refusal here is signed.
host.name = 'svelthon';

// Each name of a module is what its text makes it, a cell, a key of its store, a
// prop: the doors to its namespace, `globals()` and the others, read it and
// write nothing, which the compiler refuses where the text writes through one.
host.readOnlyNamespace = true;

// How Svelte's reactions read and write, which Bryntime follows a watched
// Python value through. Whether the code running is a reaction is Svelte's
// `$effect.tracking()`, and whether a write would be refused is a write Svelte
// checks and that changes nothing, which raises where Svelte refuses one, in a
// derived or a block. A plain module has no runes, so both are handed over by
// the first component or store that loads, whose script Svelte compiles
// (`__brycomp_pybridge.tracking`, `__brycomp_pybridge.refusing`), and the runtime asks nothing
// of Svelte's internals. Until one has, every read is taken for a reaction's,
// which costs a walk and subscribes nothing outside one, and nothing is
// refused. What a plain module holds is watched by nobody: a JavaScript
// component reading a `.py`'s list repaints on no `append`, as the README says.
host.subscriber = createSubscriber;
host.untrack = untrack;

// What Bryntime borrows of this module: the rows a Python iterable yields as
// JavaScript walks them, by the template's own walk; SvelteKit's request event,
// handed to Python as the snapshot `routeArgument` takes; and the line of its
// file a frame's line stands for, by the offset that file registered.
lent.seq = (value) => __brycomp_pybridge.seq(value);
lent.argument = (value) => routeArgument(value);
lent.place = (file, line, namespace) => inFile(line, OWN_LINES.get(namespace) ?? FILE_LINES.get(file) ?? 0);

// Whether the tag a `<svelte:element>` renders makes a custom element, as
// Svelte tells one there, by the element's name: a dash in it.
const customTag = (tag) => typeof tag === 'string' && tag.includes('-');

// The doors this module opens, each with its rule, registered under its name
// (`doors`) and held by the entry of `__brycomp_pybridge` that opens it. Held, not
// looked up: an entry is called on every crossing, and a lookup by name there
// cost 5 to 7 % of `bound`.
//
// What Python hands out to a DOM boundary, an attribute, a prop or a `bind:`
// written by name (`bound`): None the absence, a callable its handler, and a
// container its view.
const attribute = (value) => {
    if (value === NONE) return undefined;

    return value !== null && (typeof value === 'object' || typeof value === 'function') && callable(value)
        ? pyHandler(value)
        : viewOf(value);
};

// What a Python value whose `__str__` raised stands for in an attribute: the
// error, raised as the bridge raises one (`pyError`), where an attribute
// written after it may override it (`heldAttr`): when Svelte writes it, and
// never when one does.
class UnwrittenText {
    constructor(error) {
        this.error = error;
    }

    toString() {
        throw pyError(this.error);
    }
}

// The spreads that hold one (`spreadElement`).
const HOLDING = new WeakSet();

// A key Svelte takes for an attachment (`createAttachmentKey`), told as Svelte
// tells one: a symbol described `@attach`.
const attaching = (key) => typeof key === 'symbol' && key.description === '@attach';

// The boolean properties no attribute reflects, which removing the attribute
// leaves as they were: `indeterminate` has no attribute at all, and `muted`'s
// is the default.
const unreflected = (name) => typeof name === 'string' && /^(?:indeterminate|muted)$/i.test(name);

// A spread to a JavaScript child: each value crosses as a prop written by name
// does, `attribute` and then the floats of a config made numbers (`pyNumbers`),
// and an attachment as one written `{@attach …}` does (`pyAttach`): adapted as
// a handler, a raise reached the boundary as the Brython exception, where an
// `Error` is handed it.
const spread = (value) => spreadOf(value, (one, key) => (attaching(key) ? pyAttach(one) : pyNumbers(attribute(one))));

// A spread to a Python child: each value the Python value itself, as a prop
// written by name is, None the absence that reads the child's default.
const spreadPython = (value) => spreadOf(value, attribute);

doors.out('attribute', attribute);
doors.out('spread', spread);
doors.out('spread-python', spreadPython);

// The global object, for the generated code to reach `Object`, `Symbol` and
// `Error` through: a module that binds one of those names binds it in the
// generated module's own scope, where the generated code read it in its place.
export const jsGlobal = globalThis;

// The template filters, Brylters', re-exported so a generated component has one
// specifier to import rather than two, and so every satellite repo keeps the
// single `svelthon/bridge` alias it already resolves. Handed the text a template
// shows of a value, which a filter starts from: `slugify(None)` is empty, as
// `{x}` is.
export { helpers } from 'brylters';

brylters.str = (value) => __brycomp_pybridge.str(value);

// Svelte interpolates with String(), and None is an object, so it would render
// "[object Object]". Non-enumerable so nothing that walks the singleton's
// properties can see it. (The same gap remains for lists and dicts, which
// render with JavaScript's stringification rather than Python's str().)
Object.defineProperty(NONE, 'toString', {
    value: () => 'None',
    enumerable: false,
    configurable: true
});

// Inside a Svelte template you are in JavaScript, not Python, and the two
// disagree. This is the bridge behind `__brycomp_truthy`, `__brycomp_text`, `__brycomp_seq` and
// `__brycomp_spread`, the four names a compiled template expression actually calls.
//
// Only generated code types it, so its name takes no word an author may want
// from the component's scope.

// The components written in Python, as their Python parents import them. Each
// says so as its module loads, by a function that reads it, since its module's
// `export default` may not be set yet then; the functions are read when a
// parent first asks, and kept for the next time while their module still loads.
const PYTHON_COMPONENTS = new WeakSet();
const ANNOUNCED = [];

const pythonComponent = (component) => {
    for (let at = ANNOUNCED.length - 1; at >= 0; at--) {
        let one;

        try {
            one = ANNOUNCED[at]();
        } catch (error) {
            if (error instanceof ReferenceError) continue;
            throw error;
        }

        ANNOUNCED.splice(at, 1);
        if (one !== null && (typeof one === 'function' || typeof one === 'object')) PYTHON_COMPONENTS.add(one);
    }

    // The component, or what it stands for, however it reached the tag
    // (`standsFor`): the adapter an import from JavaScript made of it, the
    // function Svelthon published for a value of Python's, and the method the
    // engine wraps when Python reads it off a JavaScript object,
    // `makeBox(Child).Child`. Taken for a JavaScript child, a Python one was
    // handed JavaScript's numbers, a `Price(float)` a plain float.
    return standsFor(component, PYTHON_COMPONENTS);
};

// Each snippet from elsewhere, to the function that renders it with its
// arguments crossed (`__brycomp_pybridge.snippet`).
const CROSSING_SNIPPETS = new WeakMap();

// Each snippet a Python markup declared, as it announced itself
// (`__brycomp_pybridge.pythonSnippet`), and the calls in progress on a server that
// hand one values: what it was handed, before crossing.
const PYTHON_SNIPPETS = new WeakSet();
const SERVED_ARGUMENTS = [];
let CROSSING_PAIR = null;

// The `<select>` elements of each instance a spread may make multiple, by their
// place in the markup (`__brycomp_pybridge.selectShape`), and the one each binding's
// read holds. A place may stand for many elements, every row of an `{#each}`
// and every render of a snippet; each registers as Svelte creates it, before
// its binding first reads, and that read claims the first one unclaimed, so
// every read holds its own element. A server has no element, and its select is
// the single one written.
const SELECT_SHAPES = new WeakMap();
const SELECT_READS = new WeakMap();

const shapesOf = (scope, place) => {
    let places = SELECT_SHAPES.get(scope);

    if (places === undefined) SELECT_SHAPES.set(scope, (places = new Map()));

    let shapes = places.get(place);

    if (shapes === undefined) places.set(place, (shapes = []));

    return shapes;
};

const multipleSelect = (scope, place, read) => {
    let shape = SELECT_READS.get(read);

    if (shape === undefined) {
        shape = shapesOf(scope, place).find((one) => !one.claimed);

        if (shape === undefined) return false;

        shape.claimed = true;
        SELECT_READS.set(read, shape);
    }

    shape.mode();
    return shape.node.multiple === true;
};

// Whether a value is the value of an option of a select registered at a place,
// read as Svelte reads it (`get_option_value`): its own options and those a
// child or a snippet put there.
const optionValue = (scope, place, value) =>
    shapesOf(scope, place).some(({ node }) => {
        for (const option of node.options) {
            if (('__value' in option ? option.__value : option.value) === value) return true;
        }

        return false;
    });

// The declarations whose marker each namespace's code has called, by the
// number of their statement, the marker of each number, and the names each
// namespace has bound (`__brycomp_pybridge.declaration`).
const RUNE_MARKED = new WeakMap();
const RUNE_MARKERS = [];
const BOUND = new WeakMap();

// The tokens of the defaults being taken (`__brycomp_pybridge.initializing`).
const INITIALIZING = new Set();

// How a derived of Svelte's is made, handed over by the first module that
// loads (`__brycomp_pybridge.deriving`).
let derive;

// The reads of a prop no Python parent handed, which no signal follows
// (`readProp`), and whether the getter just read was a Python parent's
// (`handed`).
let UNFOLLOWED = 0;
let HANDED = false;

// Those reads made while expressions are weighed, two entries each, how to
// read the prop again and what it answered, and how deep the weighing is
// (`reading`).
const PASSED = [];
let WEIGHED = 0;

// Whether each read answers what it answered then.
const unmoved = (reads) => {
    for (let at = 0; at < reads.length; at += 2) {
        if (reads[at]() !== reads[at + 1]) return false;
    }

    return true;
};

export const __brycomp_pybridge = {
    // Whether the components run in a browser or render on a server, as Svelte
    // tells them apart: by what the code was resolved for (`esm-env`), and not
    // by a `document`, which a server lays down for a library or a test run
    // under jsdom. Told by one, a server with it wrote no group's selection and
    // handed a snippet reads of its arguments. Its `browser` entry, resolved by
    // the bundler under the conditions it resolves this file under, where the
    // package's index, left to Node, reads a `window` instead.
    browser: BROWSER,

    // Called by the module of each component written in Python as it loads,
    // with a function that reads the component (`pythonComponent`).
    python(read) {
        ANNOUNCED.push(read);
    },

    // The value a block declares, `{rows = [1]}`, followed as a name the
    // script declares is: every read of the name subscribes through `follow`
    // to the value's own revision, which a change made inside it moves.
    // `$state.raw` alone follows the name being written, and a list appended to
    // repainted nothing.
    //
    // One revision per value, whatever the blocks that declare it, signed onto
    // the value's watch while something reads it and off it when nothing
    // does: a block made a hundred times over one list signed a hundred
    // callbacks onto it, and kept them after the component was gone.
    state(value) {
        if (watchable(value)) BLOCK_STATE.add(value);

        return value;
    },

    // The marker the JavaScript reads at the declaration numbered `mark`, in
    // place of `derived` or `effect` (`translateMarkers`): `effect`'s own
    // `pre` and `root` included, it hands its function back, and notes the
    // number for the namespace whose code calls it (`declaration`).
    rune(mark) {
        if (RUNE_MARKERS[mark] === undefined) {
            const marker = (body) => {
                const namespace = core.runningModule()?.namespace;

                if (namespace !== null && typeof namespace === 'object') {
                    let marked = RUNE_MARKED.get(namespace);

                    if (marked === undefined) RUNE_MARKED.set(namespace, (marked = new Set()));
                    marked.add(mark);
                }

                return body;
            };

            RUNE_MARKERS[mark] = Object.assign(marker, { pre: marker, root: marker });
        }

        return RUNE_MARKERS[mark];
    },

    // A write to a rune's name, whose declaration is the statement numbered
    // `mark`; a name is declared once.
    //
    // - `1`, the binding: the first write of the name the namespace's own code
    //   makes once that statement's marker has run. Each target of `a = b =
    //   derived(…)` makes its own.
    // - `-1`, before the binding: one the namespace's own code makes before,
    //   what a `:=` in a default, a decorator or the marker's argument writes,
    //   or `globals()`. The name holds it, as Python's does, until the binding
    //   writes over it.
    // - `0`, any other: once the name is bound, `d = derived(…); d = 99` on one
    //   line among them, or from a frame of a function's or a decorator's. It
    //   is the name's, as Svelte's `doubled = 99` is to its derived.
    //
    // Asked of the write and of the declaration's own marker: one flag for the
    // page was taken by the next write of any rune name, and left raised by a
    // decorator that failed; the lines could not tell two statements sharing
    // one; and a count of every marker called took an alias of `derived`,
    // called once, for the marker of every declaration after it.
    declaration(namespace, name, mark) {
        if (core.runningLine(namespace) === undefined) return 0;

        let bound = BOUND.get(namespace);

        if (bound === undefined) BOUND.set(namespace, (bound = new Set()));
        if (bound.has(name)) return 0;
        if (!RUNE_MARKED.get(namespace)?.has(mark)) return -1;

        bound.add(name);
        return 1;
    },

    // Whether the module's own code is running the statement on `line`: a
    // prop's default is the write its annotation makes, and any other write
    // of the body is the child's own.
    declaring(namespace, line) {
        return core.runningLine(namespace) === line;
    },

    // A class the script declares, read: a reaction follows the special
    // methods its metaclass gives it, when the metaclass is the author's
    // (`followMetaclass`), and nothing else of it.
    declared(value) {
        followMetaclass?.(value);

        return value;
    },

    // An expression of the template that calls nothing, evaluated, and
    // whether it read JavaScript's own data, which no tracking of Python's
    // follows (`javascriptReads`): such an expression is read afresh at each
    // render, as Svelte reads one, where one that read only Python's is held
    // in its derived (`unmemoized`). Held whatever it read, the page kept the
    // field of a JavaScript object changed in place when it rendered again
    // for another reason. And a prop no Python parent handed (`readProp`), whose
    // getters are kept with what they answered and with what the expression
    // gave: read again at a render, it is evaluated again only once one of
    // them answers otherwise, or once its derived (`held`) moved. Evaluated
    // again at each render, the Python children of a JavaScript parent cost
    // three quarters more each time it rendered them again. Kept so, the
    // getters are handed on to the expression that reads this one.
    reading(flags, key, expression, held) {
        if (held !== undefined && typeof flags[key] === 'object') {
            held();

            const kept = flags[key];

            if (typeof kept === 'object' && unmoved(kept.reads)) {
                UNFOLLOWED += 1;
                if (WEIGHED > 0) PASSED.push(...kept.reads);

                return kept.value;
            }
        }

        const before = core.javascriptReads();
        const unfollowed = UNFOLLOWED;
        const start = PASSED.length;
        let value;
        let done = false;

        core.weighingReads(true);
        WEIGHED += 1;

        try {
            value = expression();
            done = true;

            return value;
        } finally {
            core.weighingReads(false);
            WEIGHED -= 1;

            let fresh = core.javascriptReads() !== before;

            if (UNFOLLOWED !== unfollowed) fresh ||= !done || { value, reads: PASSED.slice(start) };

            flags[key] = fresh;

            if (WEIGHED === 0 && PASSED.length !== 0) PASSED.length = 0;
        }
    },

    // What a prop holds, read: JavaScript's own object or array is counted as
    // read (`javascriptRead`), an array Python reads as a list among them.
    prop(value) {
        core.javascriptRead(value);

        return value;
    },

    // A prop the component never writes, read as Svelte reads it, through the
    // parent's getter at each read: noted as a read no signal follows, as a
    // JavaScript parent's getter may answer otherwise with none, unless a
    // Python parent's getter answered (`handed`), which weighed its own reads.
    readProp(read) {
        HANDED = false;

        const value = read();

        if (!HANDED) {
            UNFOLLOWED += 1;
            if (WEIGHED > 0) PASSED.push(read, value);
        }

        return value;
    },

    // What a Python parent's getter hands (`readProp`).
    handed(value) {
        HANDED = true;

        return value;
    },

    // Whether what a pattern's element holds is the absence its default stands
    // in for: `undefined`, as JavaScript takes a default, and None, which is
    // `undefined` at every door.
    absent(value) {
        return value === undefined || value === NONE;
    },

    // A declared class bound by its statement: one whose metaclass is the
    // author's keeps the accessor that follows it (`declared`); any other is
    // written as the namespace's own property, read as any other name is, for
    // nothing more.
    declare(namespace, name, value, classes) {
        const meta = pyClass(value) ? quietPyType(value) : undefined;

        if (meta !== undefined && authoredClass(meta)) {
            classes[name] = value;
            return;
        }

        Object.defineProperty(namespace, name, { value, writable: true, enumerable: true, configurable: true });
    },

    // A prop handed to a component a tag holds rather than names by its
    // import, a snippet's parameter or a name the script assigned: the Python
    // value itself to one written in Python, and JavaScript's to any other, as
    // a child named by its import gets it.
    child(component, value, kind = '') {
        HANDED = true;

        // Handed through a `{@render}` argument, which is Python, it comes
        // back as the adapter made for it, which knows the component.
        const python = pythonComponent(component);
        if (kind === 'spread') return python ? __brycomp_pybridge.spreadPython(value) : __brycomp_pybridge.spread(value);
        if (python) return value;
        return kind === 'scalar' ? scalarOnly(value) : pyNumbers(value);
    },

    // A binding's read/write pair, for the binding Svelte takes no pair for,
    // `bind:group` on a component, written
    // `__brycomp_pybridge.crossing[__brycomp_pybridge.pair(read, write)]`. Svelte asks there
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

        if (isDict(value)) {
            // `define`, because the key is the author's: `"__proto__"` is a
            // class name here, not the object's prototype.
            const out = {};
            for (const [key, one] of pyEntries(value)) define(out, __brycomp_pybridge.str(key), __brycomp_pybridge.truthy(one));
            return out;
        }

        // An object a JavaScript parent handed over, `{active: true}`, is what
        // Svelte reads as a set of conditional classes, and is handed to it as
        // it is, read the way it reads it.
        if (!pyClass(ownType(value)) && !VIEWED.has(value) && plainObject(value)) return value;

        // A lazy iterable, `(n for n in names if n)` or `d.keys()`, as the list
        // `list()` makes of it, as at every other door: written as its `str()`,
        // it was `<generator object <genexpr>>`.
        const made = listed(value);

        if (made !== value) return __brycomp_pybridge.klass(made);

        // The names the list yields, which for a subclass with its own
        // `__iter__` are not the ones it stores: the loop beside it reads the
        // same ones. A set is the natural type for a set of classes, and is
        // read the same way. Read by index into a plain array (`byIndex`).
        if (Array.isArray(value) || isSet(value)) {
            return byIndex(iterated(value))
                .filter((one) => __brycomp_pybridge.truthy(one))
                .map((one) => __brycomp_pybridge.klass(one));
        }

        return __brycomp_pybridge.truthy(value) ? __brycomp_pybridge.str(value) : undefined;
    },

    // A key of `{#key}` and of an `{#each}`, which Svelte compares with `===`
    // (`key`).
    key,

    // JS calls every object truthy, so `{#if items}` would be true for an empty
    // list, an empty dict, or None. Conditions are rewritten to go through this.
    truthy(value) {
        if (value === undefined || value === null) return false;
        // str/int/float/bool are JS primitives in Brython, and there the two
        // languages already agree.
        if (typeof value !== 'object' && typeof value !== 'function') return Boolean(value);
        try {
            return pyTruth(value);
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
        return __brycomp_pybridge.truthy(value);
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
            return pyStr(value);
        } catch (error) {
            if (raised(error)) throw error;
            return String(value);
        }
    },

    // A value alone in an attribute of text (`__brycomp_attr`): written as Python
    // writes it, as it is with text around it (`str`), a list `[1, 2]` and a
    // float `1.0`; what has a meaning of its own to an attribute crosses as a
    // prop does (`bound`), None the absence, a boolean its presence, a
    // callable its handler, an int and a str their own text, and a value of
    // JavaScript's as JavaScript writes it. Handed to Svelte as text, which it
    // writes as an attribute whatever property the element has of that name: a
    // `translate` of "no" stays off. A text that raises raises as it is read,
    // as Python's error: held to the write (`heldAttr`), it raised nowhere in
    // a property Svelte sets to a boolean, `translate` or `draggable`, which
    // took the object for true.
    attr(value) {
        const text = __brycomp_pybridge.heldAttr(value);

        if (text instanceof UnwrittenText) throw pyError(text.error);
        return text;
    },

    // An element where a text attribute or a spread comes before a spread
    // (`slotted` in markup.js): what each gives, kept at its place in the
    // order written in the row of the element's own instance, `slot` (`held`),
    // an attribute's under its name and a spread's (`names[at]` null) as it
    // is, and settled by its last spread, `out`, as Svelte merges them
    // (`settled`): a text that raised and that nothing written after it
    // overrode raises, `later` the names written after the last spread.
    // Merged only when one of them holds such a text. One row for the whole
    // module, a page another rendered in an attribute's value emptied, and
    // the element raised what the other's had overridden.
    held(slot, at, value) {
        slot[at] = value;

        return value;
    },

    settled(slot, later, names, out) {
        let holding = false;

        for (let at = 0; at < names.length && !holding; at++) {
            holding = names[at] === null ? HOLDING.has(slot[at]) : slot[at] instanceof UnwrittenText;
        }

        if (holding) {
            const final = new Map();

            names.forEach((name, at) => {
                const value = slot[at];

                if (name !== null) final.set(name, value);
                else for (const key of Object.keys(value ?? {})) final.set(key.toLowerCase(), value[key]);
            });

            for (const key of Object.keys(out ?? {})) final.delete(key.toLowerCase());

            for (const [key, value] of final) {
                if (value instanceof UnwrittenText && !later.includes(key)) throw pyError(value.error);
            }
        }

        return out;
    },

    // And where an attribute written after it may override it, a text that
    // raises held to the write (`UnwrittenText`).
    heldAttr(value) {
        if (value === null || typeof value !== 'object' || value === NONE || quietPyType(value) === undefined || callable(value)) return attribute(value);

        try {
            return pyStr(value);
        } catch (error) {
            if (raised(error)) return new UnwrittenText(error);
            return String(value);
        }
    },

    // `{@html}`: Python's text, but for a `TrustedHTML` an application's
    // policy made, handed as it is, which Svelte assigns to `innerHTML`
    // uncoerced. Made text, it was refused where the browser requires the
    // policy (`require-trusted-types-for`).
    html(value) {
        return globalThis.trustedTypes?.isHTML?.(value) ? value : __brycomp_pybridge.str(value);
    },

    // A JavaScript array handed back to Python. A list *is* an array in Brython,
    // but not every array is a list: one built here, by `.slice()` say, reads
    // as a `JavascriptArray`, which prints `[A, B]` where Python prints
    // `['A', 'B']`. Anything a helper hands to Python goes through this.
    list(items) {
        return pyList(items);
    },

    // What a `<select multiple>` writes back: Svelte's array of the chosen
    // options' values, which is a list in Python, with a list's methods, each
    // value crossing as a binding's does.
    selected(value) {
        return Array.isArray(value) ? pyList(value.map(pyBind)) : pyBind(value);
    },

    // A `<select>` bound by `bind:value` that a spread may make multiple:
    // Svelte reads `select.multiple` as it binds, and so does the read, through
    // the select this action registers under its place. Written before the
    // binding, it runs before Svelte first reads it.
    //
    // And the read follows the element's mode (`mode`), as Svelte's own select
    // is told of its options by observing it: a spread that turns `multiple`
    // off leaves Svelte selecting with the read it holds, the list of the
    // selection's values made for a multiple select, which a single one's
    // option holding the list itself is not; no option stayed selected.
    selectShape(node, [scope, place]) {
        const shapes = shapesOf(scope, place);
        const mode = createSubscriber((update) => {
            let multiple = node.multiple;
            const observer = new MutationObserver(() => {
                if (node.multiple !== multiple) {
                    multiple = node.multiple;
                    update();
                }
            });

            observer.observe(node, { attributes: true, attributeFilter: ['multiple'] });
            return () => observer.disconnect();
        });
        const shape = { node, claimed: false, mode };

        shapes.push(shape);

        return {
            destroy() {
                const at = shapes.indexOf(shape);

                if (at !== -1) shapes.splice(at, 1);
            }
        };
    },
    // `read` is the binding's read itself, one per element, which holds the
    // element it first claims (`multipleSelect`).
    selectRead(value, scope, place, read) {
        return (multipleSelect(scope, place, read) ? COMPARED.selection : COMPARED.scalar)(value);
    },
    // The write of the same binding, which Svelte hands no element: what a
    // single select writes is the value of one of its options, as Svelte reads
    // it off the option, and a multiple one an array Svelte made of them, which
    // is none of their values.
    selectWrite(scope, place) {
        return (value) => (Array.isArray(value) && !optionValue(scope, place, value) ? __brycomp_pybridge.selected(value) : pyBind(value));
    },

    // `{#each}` walks a JavaScript array. A Python list or tuple already is one,
    // but a dict, a set, a range, a generator or the result of .items() is not,
    // and iterating those is the whole point of writing the loop in Python.
    //
    // None walks nothing, as Svelte walks nothing of `null`: None is absence in
    // the template, as for a value it renders and an attribute it writes, and a
    // list a prop or a fetch has not handed over yet renders as no rows.
    seq(value) {
        if (value === undefined || value === null || value === NONE) return [];

        // The rows of a block are what it walks: their own changes run it.
        if (SHAPING.on) followOwn(value);

        // An object of JavaScript's that is no iterable is walked as Svelte
        // walks one, `Array.from`: its items by its `length`, an array-like,
        // and otherwise none. Taken for a mapping, `{length: 2, 0: "x", 1:
        // "y"}` walked its keys, `0, 1, length`. A `for` of the script keeps
        // them, Python's to read. Asked whether it has an iterator, not what
        // it is, so a getter of the author's is not run twice.
        if (typeof value === 'object' && !Array.isArray(value) && javascriptOwn(value) && !(Symbol.iterator in value)) {
            return Array.from(value);
        }

        let rows;

        if (Array.isArray(value)) {
            // What the class says it yields, which for a list is the array
            // itself and one identity compare.
            rows = iterated(value);
        } else {
            try {
                // Everything else Python calls iterable, materialised once. A
                // generator is spent by this and the walk below reads the list,
                // never the iterator again. The pairs `enumerate()`, `zip()` and
                // `.items()` make are noted as theirs (`sameRow`).
                rows = pyList(value);

                if (makesPairs(value)) for (const row of rows) MADE_ANEW.add(row);
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

        // Rows that are tuples the iterable did not make itself, the pairs of
        // `sorted(d.items())`, have the pairs noted as they are made at the
        // block's next computations (`computed`); asked of the first row.
        if (computingFor !== null) computingFor.noting = !makesPairs(value) && isTuple(rows[0]);

        // Hand the watch down to the rows: {#each} walks the array in
        // JavaScript, never through $getitem, so this is the only path by which
        // an item can come under watch before its block reads it.
        //
        // The rows the loop is given, and not where they came from: the
        // storage of a list subclass is not what a redefined `__iter__` yields,
        // and a plain class with an `__iter__`, a collection by composition,
        // has rows too. Once the rows exist the question is the same for every
        // shape, so it is asked once, here.
        //
        // Once per change of a list walked as it is stored: what it holds was
        // handed down when it was last walked, and a change inside a row, which
        // evaluates the block's iterable again (`collection`), changes nothing
        // of that. Walked every time, a thousand rows each written as they
        // mount made a million links checked.
        const marker = MARKS.get(value);

        if (marker !== undefined && (rows !== value || marker.handed !== marker.stamp)) {
            for (const item of rows) inherit(value, item);
            if (rows === value) marker.handed = marker.stamp;
        }

        return rows;
    },

    // What a `{@debug}` logs of a Python value: a copy of it as JavaScript
    // reads it, made at each read, so a list changed in place is a new value
    // and is logged again, as Svelte logs a state it follows. A value nothing
    // copies is logged as it is: a log never takes the page down.
    debugged(value) {
        try {
            return plainData(value);
        } catch {
            return value;
        }
    },

    // The answer to `$effect.tracking()`, handed over by a component or a
    // store as it loads (`host.reacting`).
    tracking(answer) {
        host.reacting = answer;
    },

    // A write Svelte checks and that changes nothing, handed over the same way:
    // a write is refused where it raises (`host.refuses`).
    refusing(write) {
        host.refuses = () => {
            try {
                write();
                return false;
            } catch {
                return true;
            }
        };
    },

    // What a component or a store hands Svelte's `$state` as it loads, so the
    // runtime learns the mark of a state of Svelte's (`stateOwned`).
    stateProbe() {
        return stateProbe();
    },

    // And how to make an object a state of Svelte's, the crossing's
    // `host.adopt`.
    proxying(make) {
        host.adopt = make;
    },

    // And how to make a derived of Svelte's, which a binding's read crosses.
    deriving(make) {
        derive = make;
    },

    // What an element's binding reads, through a derived of its own: a value
    // that has not changed runs none of the effects that hand it to the
    // element. A container's member is followed with the container, so a
    // write of one member ran the effect of every other bound to it, which
    // handed the element the member's value before the element's own event
    // had brought it back: an `<audio>` whose volume, rate and mute were set
    // together kept the volume and lost the rest, set back to what they were.
    // Svelte follows each member of its own state apart, and loses none.
    //
    // In a reaction alone, which is what the derived spares: Svelte reads the
    // binding again outside one, after an `input` event and a tick, and the
    // block may be gone by then, its derived with it, which Svelte warns about
    // reading (`derived_inert`).
    boundRead(read) {
        if (derive === undefined) return read;

        const derived = derive(read);

        return () => (host.reacting() ? derived() : read());
    },

    // The value of a `use:`, read as Svelte reads an action's value in the
    // effect that hands it to `update` (`readState`), and handed back as it
    // is. It reaches Svelte inside the directive's array, which Svelte does
    // not read into, so a change inside a state handed to the action never
    // called `update`. In that effect alone: Svelte hands the action its
    // first value untracked, and an action without `update` gets no effect,
    // where a read through ran the value's getters ahead of the action, or
    // with no action at all.
    watched(value) {
        if (host.reacting()) readState(value);
        return value;
    },

    // A function or a class of the `<script module>` held under another
    // variable (`holdRunes`), given back the name it was declared or assigned
    // under, which `.name` reads, and handed back. Here, where `Object` is
    // JavaScript's: written in the module, it read the module's own. Only the
    // name JavaScript gave, a text no one may write: a static method or
    // accessor `name` the class defines, by whatever key, is the author's, and
    // told from the class's text, one under a computed key was written over.
    named(value, name) {
        const own = Object.getOwnPropertyDescriptor(value, 'name');

        if (typeof own?.value === 'string' && !own.writable) Object.defineProperty(value, 'name', { value: name, configurable: true });
        return value;
    },

    // The rows an `{#each}` walks, and whether they are still the ones its
    // block holds. The block runs again on a change of the rows themselves, a
    // row added, removed, moved or replaced, and not on a change inside a row,
    // which reaches only what reads that row. Svelte's proxies give its own
    // block exactly that.
    //
    // The iterable is Python, computed as Svelte's proxies are read (`shaped`):
    // again on a change of what it read, and not on a change inside a row it
    // did not read into. And `refresh` compares what it yields with what the
    // block holds: the same list, unchanged since (its `stamp`), with nothing
    // to compare; otherwise row by row, by identity, and a tuple, which
    // `enumerate()` and `.items()` make anew each time, by what it holds. Each
    // component's `__brycomp_collection` carries the result to the block with Svelte's
    // own runes, which this file, made for any host, does not hold.
    //
    // A copy, since a list changes in place and the next comparison is with
    // what it held.
    //
    // A keyed block runs again, too, when a change in a row moves its key: the
    // block reads its keys with the rows unfollowed (`eachKey`) and notes each
    // (`noted`), and the key of a row something changed under since is read
    // again here, unfollowed, against the one noted, as the effect that
    // refreshes the rows is told of a change under any of them (`watch`). One
    // read per row changed, where Svelte, whose key reads the one field it
    // names, needs none: a container is the finest a change is known at here.
    walk(keyOf) {
        let held;
        let source;
        let stamp;
        let recomputed = false;
        let moved;
        let keys = [];
        let update;
        let under = new Set();
        const told = () => update?.();
        const underRows =
            keyOf === undefined
                ? undefined
                : host.subscriber((one) => {
                      update = one;
                      under = trackEach(held ?? [], told, under);

                      return () => {
                          update = undefined;
                          under = trackEach([], told, under);
                      };
                  });

        // And the computation of the rows told, by one subscriber, of an own
        // change of anything it read (`shaped`): what it read last, and what
        // the subscriber is signed onto.
        let ownUpdate;
        let read = new Set();
        let owned = new Set();
        const ownTold = () => ownUpdate?.();
        const readChanges = host.subscriber((one) => {
            ownUpdate = one;
            owned = trackOwns(read, ownTold, owned);

            return () => {
                ownUpdate = undefined;
                owned = trackOwns(new Set(), ownTold, owned);
            };
        });

        const rekeyed = () => {
            let changed = false;

            for (let at = 0; at < held.length; at++) {
                const seen = seenUnder(held[at]);

                if (seen === moved[at]) continue;

                moved[at] = seen;

                if (at in keys && untrack(() => keyOf(held[at], at)) !== keys[at]) changed = true;
            }

            return changed;
        };

        return {
            // What the block walks, undefined until the first `refresh`.
            get held() {
                return held;
            },

            // Told, the caller, of a change under any row a keyed block holds.
            watch() {
                underRows?.();
            },

            // The rows the iterable yields, its pairs noted as they are made
            // when the block needs them noted (`noting`).
            computed(compute) {
                recomputed = true;
                return computed(this, compute);
            },

            // What the computation read, followed for its own changes.
            readOwn(markers) {
                read = markers;
                if (ownUpdate !== undefined) owned = trackOwns(markers, ownTold, owned);
                readChanges();
            },

            // Whether `rows` differ from the rows the block holds, which they
            // then become.
            refresh(rows) {
                const walked = Array.isArray(held);
                const again = recomputed;

                recomputed = false;

                // A foreign iterable is walked as Svelte walks one.
                if (!Array.isArray(rows)) {
                    held = rows;
                    return true;
                }

                const marker = MARKS.get(rows);
                let unchanged =
                    walked && ((rows === source && marker !== undefined && marker.stamp === stamp) || sameRows(held, rows));
                const anew = again || rows !== source;

                source = rows;
                stamp = marker?.stamp;

                // A keyed block walks again an iterable made anew, `rows =
                // list(rows)`, or computed again, `current(revision)` yielding
                // the same list, as Svelte's does, reading every key: one may
                // read what nothing follows, a JavaScript object's field, or a
                // pair made anew itself, `id(pair)`, and the block kept the key
                // noted. Compared here first, the keys up to the first that
                // moved were read again by the block, past Svelte's reads.
                if (unchanged && keyOf !== undefined && anew) unchanged = false;
                if (unchanged && !(keyOf !== undefined && rekeyed())) return false;

                held = Array.from(unchanged ? held : rows);
                keys = [];
                if (keyOf !== undefined) moved = held.map(seenUnder);
                if (update !== undefined) under = trackEach(held, told, under);

                return true;
            },

            // The key the block read for the row at `at`, handed back.
            noted(at, key) {
                keys[at] = key;
                return key;
            }
        };
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
    bound: attribute,

    // And to a binding Svelte reads for truth, `bind:checked` on an element:
    // Python's truth of the value, as `checked={…}` reads it, where an empty
    // list handed over as its view was JavaScript's true. An absence, None or
    // `javascript.NULL`, stays one, from which Svelte reads the element's own
    // state, as from `undefined` and `null`.
    boundTruth(value) {
        if (value === NONE || value === undefined) return undefined;

        return value === null ? null : __brycomp_pybridge.truthy(value);
    },

    // The snippet a `{@render}` renders when its spelling does not say whose it
    // is: `children`, an alias, an attribute, a key. One a Python markup
    // declares reads its arguments as Python values: this markup's own, among
    // `owns`, the ones in scope there, and any other once it has announced
    // itself (`pythonSnippet`), a Python parent's. Any other comes from
    // elsewhere, maybe JavaScript, and its arguments cross as a prop's do
    // (`bound`). Decided by the snippet rendered rather than by its name:
    // `{alias = row}` rendered an `int` where `row` rendered `1.0`, and so did a
    // Python parent's snippet rendered by a Python child.
    //
    // One crossing function per snippet, kept, since Svelte renders again when
    // the function it is handed changes. A browser hands a snippet a read of
    // each argument, read once the snippet has announced itself, which is the
    // first thing it does; a server hands it the values themselves, crossed
    // before the call, so the ones it was handed are kept for it meanwhile.
    //
    // The snippet is known by what it stands for (`standsFor`), as a component
    // is: read off a JavaScript object, `holder.fn`, it is the engine's wrapper
    // of the Python snippet, bound to the object, and was taken for a
    // JavaScript one, its `1.0` handed over as `1`.
    snippet(value, owns) {
        const fn = __brycomp_pybridge.bound(value);

        if (typeof fn !== 'function' || owns.includes(fn)) return fn;

        let crossing = CROSSING_SNIPPETS.get(fn);

        if (crossing === undefined && standsFor(fn, PYTHON_SNIPPETS)) return fn;

        if (crossing === undefined) {
            const crossed = (one) => pyNumbers(__brycomp_pybridge.bound(one));

            crossing = BROWSER
                ? (anchor, ...args) =>
                      fn(anchor, ...args.map((one) => () => (standsFor(fn, PYTHON_SNIPPETS) ? one() : crossed(one()))))
                : (renderer, ...values) => {
                      SERVED_ARGUMENTS.push({ fn, values });

                      try {
                          return fn(renderer, ...values.map(crossed));
                      } finally {
                          SERVED_ARGUMENTS.pop();
                      }
                  };
            CROSSING_SNIPPETS.set(fn, crossing);
        }

        return crossing;
    },

    // What a snippet a Python markup declares does first of all, before it
    // takes its arguments apart: it says so, and on a server, called by a
    // crossing, takes back the values it was handed before they crossed, which
    // its parameters read by position (`param`).
    pythonSnippet(fn) {
        PYTHON_SNIPPETS.add(fn);

        const call = SERVED_ARGUMENTS[SERVED_ARGUMENTS.length - 1];

        // The call may have been made through what stands for it, its wrapper.
        return call !== undefined && standsFor(call.fn, new Set([fn])) ? call.values : null;
    },

    // What a module SvelteKit keeps out of the browser says as it runs: its
    // name, refused at the transport (`refusedModule`).
    serverModule(name) {
        SERVER_MODULES.add(name);
    },

    // A `bind:group` control's `checked`, written by the server, where no action
    // runs: whether the model holds the control's value, by the rules the
    // browser's group follows (`groupHolds`, `sameChoice`), as Svelte's server
    // writes it for its own group. In the browser the action keeps the control,
    // and this answers nothing, which Svelte leaves alone; the model and the
    // value are handed over as reads, so the browser reads neither.
    groupChecked(model, chosen, boxes) {
        if (BROWSER) return undefined;

        const value = chosen();

        if (value === undefined) return undefined;

        const mine = pyBind(value);
        const current = model();

        return boxes ? groupHolds(current, mine) : sameChoice(current, mine);
    },

    // What a context holds, written by Python. Either end may be JavaScript's,
    // so a callable is published as at every other door (`pyHandler`) and a
    // JavaScript reader can call it; a scalar is made JavaScript's, `None` its
    // `undefined` (`plainScalar`); a container is the object it is.
    toContext(value) {
        return value !== null && (typeof value === 'object' || typeof value === 'function') && callable(value)
            ? pyHandler(value)
            : viewOf(plainScalar(value));
    },

    // A value handed into Python by a door that may be JavaScript's, a context
    // or a snippet's parameter: read as `pyBind` reads every door's, a
    // function as `functionIn` takes it and a view its container.
    received(value) {
        return pyBind(value);
    },

    // The argument at a position of a snippet a Python markup declares, which
    // the snippet takes apart itself (`snippetParameters`): the value a
    // server's crossing kept for it before crossing, which its announcement took
    // back, or what the call handed it, read as every door's is; its default
    // when nothing was handed, or None, as Svelte reads one on `undefined`.
    param(value, served, at, fallback) {
        const given = served !== null && at < served.length ? served[at] : value;

        return __brycomp_pybridge.absent(given) && fallback !== undefined ? fallback() : pyBind(given);
    },

    // A default of a positional pattern taken under its token, and a name an
    // element after it binds read through that token: JavaScript's error while
    // the default is taken, the name not bound yet, and the name once it is,
    // as a function the default made reads it when it is called. A token for
    // each taking, so that one row's taking leaves another row's functions be.
    token() {
        return {};
    },

    initializing(token, run) {
        INITIALIZING.add(token);

        try {
            return run();
        } finally {
            INITIALIZING.delete(token);
        }
    },

    ahead(token, name, read) {
        if (INITIALIZING.has(token)) throw new ReferenceError(`Cannot access '${name}' before initialization`);

        return read();
    },

    // The row a snippet's positional pattern takes apart, as Svelte's own
    // `to_array` takes one: an array as it is, so that an element is read where
    // it is read and a change made in place is seen, and another iterable as
    // its first `length` elements, which is as far as the pattern reads. A
    // value of Python's is walked as Python walks it (`pyLeading`): asked for
    // JavaScript's protocol, a `range`, a generator or an `__iter__` had none,
    // and the pattern read empty positions without a word. And so is a value
    // JavaScript hands back as the view of one of Python's, a dict a promise
    // resolved: taken apart as the view, it gave nothing, where the dict gives
    // its keys.
    positional(value, length) {
        const python = pyLeading(VIEWED.has(value) ? pyBind(value) : value, length);

        if (python !== null) return python;
        if (Array.isArray(value)) return value;
        if (!(Symbol.iterator in value)) return Array.from(value);

        const row = [];

        for (const one of value) {
            row.push(one);
            if (row.length === length) break;
        }

        return row;
    },

    // The row a pattern around a starred name takes apart, `before` elements
    // ahead of the star and `after` behind it: an array of JavaScript's as it
    // is, the rest made Python's list, so that an element absent, `undefined` or
    // a hole, still takes its default, as it does without the star (`positional`).
    // Taken apart by Python first, the absence was `None`, a value, and the
    // default was never taken. A row too short is absent where it ends, as
    // JavaScript reads one without the star: `[a="d", b="e", *rest]` on `[]`
    // takes both defaults and an empty rest, where it raised Python's
    // `ValueError`. Any other row, a value of Python's, is Python's to take
    // apart, with Python's errors (`unpack`), and so is the view JavaScript
    // hands back of one, as `positional` takes it: taken apart as the array it
    // looks like, a list a promise resolved lost its elements' methods and its
    // own `__iter__`.
    starred(value, before, after, unpack) {
        if (!Array.isArray(value) || pyLeading(VIEWED.has(value) ? pyBind(value) : value, 0) !== null) return unpack();

        const remaining = value.slice(before);
        const middle = Math.max(0, remaining.length - after);

        return [
            ...Array.from({ length: before }, (_, at) => value[at]),
            pyList(remaining.slice(0, middle).map(pyBind)),
            ...Array.from({ length: after }, (_, at) => remaining[middle + at])
        ];
    },

    // A name of that pattern before or after the star (`slot`), read again at
    // each read from the array `starred` took apart in JavaScript, as Svelte
    // reads `[first, ...rest]`: copied out, `first` kept the element the array
    // held first. A row of Python's, or its view, keeps what it was taken apart
    // to (`taken`).
    starredRead(value, before, after, slot, taken) {
        if (!Array.isArray(value) || pyLeading(VIEWED.has(value) ? pyBind(value) : value, 0) !== null) return taken();
        if (slot < before) return value[slot];

        return value[before + Math.max(0, value.length - before - after) + slot - before - 1];
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
    //
    // And it hands back what it was given, as Svelte's `setContext` returns its
    // context: the Python value itself, `model = set_context("model", data)`
    // naming `data`, where it named None.
    provide(set, get, own, key, value) {
        const out = __brycomp_pybridge.toContext(value);

        set(key, out);

        let originals = get(ORIGINALS);
        const owner = own();

        if (originals?.owner !== owner) {
            originals = { owner, byKey: new Map(originals?.byKey) };
            set(ORIGINALS, originals);
        }

        originals.byKey.set(key, { js: out, py: value });

        return value;
    },

    provided(get, key) {
        const value = get(key);
        const original = get(ORIGINALS)?.byKey.get(key);

        return original !== undefined && Object.is(value, original.js) ? original.py : __brycomp_pybridge.received(value);
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
    spread,

    // The same props handed to a child written in Python, each the Python value
    // itself, as one written by name is handed to it: None among them is None,
    // and not the absence that reads the child's default.
    spreadPython,

    // A spread on an element: each key is the attribute it becomes, read the
    // way that attribute is read when written by name. Each value crosses
    // first as one written by name does (`spread`): None the absence, a float,
    // an int or a str of a subclass its scalar, where `min` and `step` read
    // `[object Object]`, and an object the object, which is how an `<option>`'s
    // value finds its `<select>`. A `value` is made JavaScript's as `value={…}`
    // is (`COMPARED`), from the value itself: a float its number, which the
    // `<select>` it is compared with holds too, and on a control a `bind:group`
    // binds (`grouped`), what the group reads (`choice`).
    //
    // A key Svelte takes for a handler, one beginning with `on`, is adapted as
    // a handler written by name is, by the component's `event`: a raise reaches
    // the page as an `Error` and a coroutine is run and its failure reported,
    // where a callback's contract handed the host the Brython exception and a
    // rejected promise nobody looks at.
    //
    // Each property is read once, as a JavaScript spread reads it: a getter
    // asked again may answer otherwise, or refuse.
    //
    // On a custom element (`custom`), a key of the boolean table, `hidden`
    // among them, is a property's, which Svelte sets to the value as it is, as
    // `open={…}` there.
    //
    // A text that raises raises as it is read (`attr`), but under a key an
    // attribute written after the spread may override, one of `later`, the
    // names written after it, or any key where a spread follows (`true`).
    spreadElement(value, event = (one) => pyEvent(one), grouped = false, custom = false, later = true) {
        if (value === null || value === undefined || value === NONE) return spreadOf(value);

        const read = spreadOf(value, (one) => one);
        const out = spread(read);

        // None stays the absence `spread` made of it under a key of the
        // boolean table too, which removing the attribute an element reflects
        // turns off: made False, it was the word "false" on an element with no
        // such property, `<a disabled="false">`, which no server wrote. Save a
        // property no attribute reflects, which an absence leaves as it was: a
        // box stayed `indeterminate`.
        for (const key of Object.keys(out)) {
            const wrapper = attributeWrapper(key);
            const present = read[key] !== NONE || unreflected(key);
            if (key[0] + key[1] === 'on') out[key] = event(read[key]);
            else if (wrapper === '__brycomp_class') out[key] = __brycomp_pybridge.klass(read[key]);
            else if (wrapper === '__brycomp_truthy' && !custom && present) out[key] = __brycomp_pybridge.truthy(read[key]);
            else if (wrapper === '__brycomp_hidden' && !custom && present) out[key] = __brycomp_pybridge.hidden(read[key]);
            else if (key === 'value') out[key] = (grouped ? COMPARED.choice : COMPARED.scalar)(__brycomp_pybridge.bound(read[key]));
            else if (!custom && textAttribute(key)) {
                out[key] = (later === true || later.includes(key.toLowerCase()) ? __brycomp_pybridge.heldAttr : __brycomp_pybridge.attr)(read[key]);
                if (out[key] instanceof UnwrittenText) HOLDING.add(out);
            }
        }

        return out;
    },

    // An attribute of the boolean table on a `<svelte:element>` whose tag is
    // known only as it renders, `tag`: on a custom element, which Svelte tells
    // by its name (`element.nodeName.includes('-')`), a property's, set to the
    // value as it is, and on any other element its Python truth, `hidden` with
    // its third state (`wrapper`). `value` is the Python value.
    element(tag, wrapper, value, name) {
        if (customTag(tag) || (value === NONE && !unreflected(name))) return __brycomp_pybridge.bound(value);
        if (wrapper === '__brycomp_attr') return __brycomp_pybridge.attr(value);
        if (wrapper === '__brycomp_heldAttr') return __brycomp_pybridge.heldAttr(value);

        return wrapper === '__brycomp_hidden' ? __brycomp_pybridge.hidden(value) : __brycomp_pybridge.truthy(value);
    },

    // And a spread there, the same question asked of each key it gives, of the
    // entries the spread read (`spreadEntries`).
    elementSpread(tag, value, event, grouped = false, later = true) {
        return __brycomp_pybridge.spreadElement(value, event, grouped, customTag(tag), later);
    },

    // The entries a spread reads, each once, the values as they are: a fresh
    // object at each read, which a dict changed in place moves.
    spreadEntries(value) {
        return value === null || value === undefined || value === NONE ? value : spreadOf(value, (one) => one);
    }
};

// The doors `__brycomp_pybridge` and the boundaries below open, under their names
// (`doors`): each entry is its door's rule, and holds it. A child's door takes
// the component after the value; a constant defined further down is read at
// the call.
doors.out('spread-element', __brycomp_pybridge.spreadElement);
doors.out('child', (value, component, kind) => __brycomp_pybridge.child(component, value, kind));
doors.out('each', __brycomp_pybridge.seq);
doors.out('debug', __brycomp_pybridge.debugged);
doors.out('context', __brycomp_pybridge.toContext);
doors.out('action', __brycomp_pybridge.watched);
doors.out('class', __brycomp_pybridge.klass);
doors.out('key', __brycomp_pybridge.key);
doors.out('truth', __brycomp_pybridge.truthy);
doors.out('hidden', __brycomp_pybridge.hidden);
doors.out('text', __brycomp_pybridge.str);
doors.out('snippet', __brycomp_pybridge.snippet);
doors.out('export', pyExport);
doors.out('handler', pyEvent);
doors.out('attach', pyAttach);
doors.out('expression', pyNumbers);
doors.out('expression-python', (value) => keptPython(value));
doors.out('expression-child', (value) => handedPython(value));
doors.out('expression-scalar', (value) => COMPARED.scalar(value));
doors.out('expression-selection', (value) => COMPARED.selection(value));
doors.in('context', __brycomp_pybridge.received);
doors.in('snippet-param', __brycomp_pybridge.param);
doors.in('selected', __brycomp_pybridge.selected);
doors.in('list', __brycomp_pybridge.list);
doors.in('load', pyArg);

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
//
// None is absence, as it is for a value the template renders and an attribute
// it writes: it spreads nothing, as Svelte spreads nothing of `null` and
// `undefined`, and `extra: dict = None` is an optional prop handed on. A rest
// still refuses it, as Svelte refuses to take a `null` row apart.
function spreadOf(value, convert) {
    if (value === null || value === undefined) return value;
    if (value === NONE) return undefined;

    const out = {};

    if (javaScriptRow(value)) {
        for (const key of Reflect.ownKeys(value)) {
            if (Object.prototype.propertyIsEnumerable.call(value, key)) define(out, key, convert(value[key], key));
        }

        return out;
    }

    for (const [key, one] of starredEntries(value)) define(out, propertyName(key, out), convert(one, key));

    return out;
}

// Whether two walks of an `{#each}` yield the same rows (`walk`): each the same
// object, or a pair the iterable makes anew at each walk, `enumerate()`'s,
// `.items()`'s or `zip()`'s, holding the same ones.
const sameRows = (held, rows) => held.length === rows.length && held.every((one, at) => sameRow(one, rows[at]));

const sameRow = (one, other) => one === other || (MADE_ANEW.has(one) && MADE_ANEW.has(other) && samePair(one, other));

// Such a pair, told by where it came from, and not by what it is: a tuple the
// author's code makes at each call, `[(row,)]`, has the shape of one, a tuple
// nobody watches holding a row, and is a new row however equal, as in Svelte,
// whose key and whose reads see the new one: `id(pair)` kept the old block.
//
// Noted by `seq` when the iterable makes them itself, `enumerate(rows)`, and
// otherwise as they are made, while the block computes its rows (`computed`),
// so they are known wherever they go next: `sorted(d.items())` hands on the
// very pairs `.items()` made, in a list of its own. Read off the iterable
// alone, a list made of them was only a list, and a change inside one row read
// every row again.
const MADE_ANEW = new WeakSet();
const madeAnew = (pair) => MADE_ANEW.add(pair);

// The pairs `.items()`, `enumerate()` and `zip()` make are noted while a block
// computes its rows (`notingPairs`), and only for a block whose rows are tuples
// its iterable does not make itself, which `seq` tells (`noting`). The note
// costs a generator per pair, measured above the noise on the `enumerate(rows)`
// of twenty thousand rows, so the common case does not pay it.
let computingFor = null;

function computed(walk, compute) {
    const outer = computingFor;

    computingFor = walk;

    try {
        return shaped(
            () => (walk.noting !== false ? notingPairs(madeAnew, compute) : compute()),
            (markers) => walk.readOwn(markers)
        );
    } finally {
        computingFor = outer;
    }
}

// Inside such a pair, a member is the same row's, or a pair nested in it and
// made the same way, `enumerate(d.items())`'s: a tuple nobody watches that
// holds something watched.
const samePair = (one, other) =>
    one.length === other.length && one.every((member, at) => member === other[at] || (nested(member) && nested(other[at]) && samePair(member, other[at])));

const nested = (row) => isTuple(row) && !MARKS.has(row) && row.some((one) => MARKS.has(one) || nested(one));

// The last walk a change made under a row climbed through (`seen`), or under
// what a tuple holds: the pairs `enumerate()` makes are watched by no one, and
// the row inside is.
const seenUnder = (row) => {
    const seen = MARKS.get(row)?.seen ?? 0;

    return isTuple(row) ? row.reduce((last, one) => Math.max(last, seenUnder(one)), seen) : seen;
};

// The marker of a watched container, and the one export in this file that exists
// for a test. Counting the subscribers of a shared list is the measurement the
// leak tests are built on, and the marker is not a property anyone can
// reach; naming the door here is what keeps that measurement possible, and the
// rule the project already follows for an internal it depends on: when the code
// reads a name, a test names it too.
// A view is asked for its container's, which a store hands JavaScript as one.
export const marks = (value) => MARKS.get(VIEWED.has(value) ? pyBind(value) : value);

// A Python line as a line of the file. `lines` is a number, the count of lines
// before the `<script>` body, or that number with the ranges of Python lines
// the template's functions occupy, since those are generated after the body: a
// line in one of them is reported at the markup it stands for, and any other
// line is the author's own.
const inFile = (line, lines) => {
    if (typeof lines === 'number') return line + lines;

    const range = lines.ranges.find(([from, to]) => line >= from && line <= to);

    // Its expression starts on the line after the `def`, and runs over the
    // lines of markup it was written on.
    return range === undefined ? line + lines.offset : range[2] + Math.max(0, line - range[0] - 1);
};

// That offset, per file, as each component registers its own when its module
// runs, and the one place a frame's line is placed from. A line belongs to the
// file its frame is in, and the caller does not know that file: a callback a
// library keeps is called with no component around it, and a handler a
// component sets may be a `.py`'s function, which has no offset and no entry.
// An offset handed in by the caller placed the first in its Python block and
// the second as if it were the component's.
//
// Keyed by the namespace the frame holds as its globals: two variants of one
// file, which a plugin may shift by lines, are two namespaces, and the last
// one mounted placed the other's lines. And by the path a component is shown
// by, relative to its project, for a frame of a namespace none registered: one
// project runs per runtime, whose Brython modules are named by that same path.
const OWN_LINES = new WeakMap();
const FILE_LINES = new Map();

export const fileLines = (file, lines, namespace) => {
    FILE_LINES.set(file, lines);
    if (namespace !== undefined) OWN_LINES.set(namespace, lines);
};



// The key the originals of a context's Python values are kept under, in the
// context itself (`provide`).
const ORIGINALS = Symbol('svelthon.context-originals');


// Svelte's mark of a state of its own, which it does not publish: the key its
// `proxy` looks for first in what it is handed, found as it looks, by a probe a
// component or a store hands it in a rune as it loads (`stateProbe`). Until
// one has, an object written into a view is copied.
let STATE;

const stateProbe = () =>
    STATE === undefined
        ? new Proxy(
              {},
              {
                  has(target, key) {
                      if (STATE === undefined && typeof key === 'symbol') STATE = key;
                      return Reflect.has(target, key);
                  }
              }
          )
        : undefined;

// Whether a Svelte state owns `value`, asked as Svelte asks it of what is put
// into its state: whether the value holds its mark. Asked of the object and
// nothing else: a guess from how a proxy behaves took a proxy of anyone's for
// Svelte's, and ran a handler of the author's that Svelte never runs. The
// crossing asks it as the host's answer (`host.owns`).
const stateOwned = (value) => {
    if (STATE === undefined) return false;

    try {
        return STATE in value;
    } catch {
        return false;
    }
};

host.owns = stateOwned;

// The prototypes whose getters Svelte does not run as it reads an object.
const PLAIN_PROTOTYPES = new Set([Object.prototype, Array.prototype, Map.prototype, Set.prototype, Date.prototype]);

// Svelte's `deep_read`: every object reached is read to its end, a Date by its
// time and an instance of a class of its own by its prototype's getters, so
// the effect reading it follows each change inside it. An object of Python's
// is not walked, its engine's own fields with it: what Python changes in it
// is followed already.
const deepRead = (value, visited) => {
    if (typeof value !== 'object' || value === null || value instanceof EventTarget || visited.has(value)) return;
    if (VIEWED.has(value) || (!stateOwned(value) && quietPyType(value) !== undefined)) return;

    visited.add(value);

    if (value instanceof Date) value.getTime();

    for (const key in value) {
        try {
            deepRead(value[key], visited);
        } catch {
            // Read on, as Svelte does.
        }
    }

    const prototype = Object.getPrototypeOf(value);

    if (prototype === null || PLAIN_PROTOTYPES.has(prototype)) return;

    for (const one of Object.values(Object.getOwnPropertyDescriptors(prototype))) {
        try {
            one.get?.call(value);
        } catch {
            // Read on, as Svelte does.
        }
    }
};

// A Python object's own fields are its attributes, in its `__dict__` and in
// its slots, an inherited one included, read as stored and without a property
// of the author's run (`slotValues`).
const storedFields = (value) => {
    const attributes = ownAttributes(value);
    const fields = [...slotValues(value).values()];

    if (attributes !== null && attributes !== undefined && isDict(attributes)) {
        for (const [, one] of heldEntries(attributes)) fields.push(one);
    }

    return fields;
};

// The class of a value, when its author wrote it.
const authoredType = (value) => {
    const type = quietPyType(value);

    return type !== undefined && authoredClass(type) ? type : undefined;
};

// What a Python container holds, as Svelte reads what its own state holds: an
// object of JavaScript's is read to its end (`deepRead`), and a container is
// walked in its turn, and so is an instance of the author's, by its fields, as
// Svelte reads an instance its state holds: `[Box(model)]` handed to an action
// followed `model` no more. Walked as stored and not through its view, which
// converts each value and subscribes the reader to it, a thousand times the
// cost on a list of two thousand rows, for changes Python follows already.
//
// An instance's `property` is read too, as Svelte runs the getters of its
// prototype, and what it returns is not walked, as there: `[box]` whose
// `amount` returns a `count` followed `count` no more, where an interpolation
// of `box.amount` did. Its class is read for them once in a walk, where each
// of two thousand rows reading it made an update near three times the cost.
//
// And so is any value's of a class of the author's, whatever it descends from,
// `class Rows(list)`, `class Tags(set)` or `class Price(float)`, as Svelte runs
// a subclass's getters past its rows or its number: `[rows]` whose `amount`
// returned a `count` followed it no more. A set's members are not walked, as
// Svelte reads none of a `Set`'s.
const heldStates = (value, visited, accessors = new Map()) => {
    if (visited.has(value)) return;

    visited.add(value);

    const visit = (one) => {
        if (typeof one !== 'object' || one === null) return;

        if (pyContainer(one) || authoredType(one) !== undefined) heldStates(one, visited, accessors);
        else deepRead(one, visited);
    };

    if (Array.isArray(value)) for (const one of value) visit(one);
    else if (pyContainer(value)) for (const [, one] of heldEntries(value)) visit(one);

    const type = authoredType(value);

    if (type === undefined) return;
    if (!accessors.has(type)) accessors.set(type, ownAccessors(type));
    for (const one of storedFields(value)) visit(one);
    for (const name of accessors.get(type)) {
        try {
            pyGetattr(value, name);
        } catch {
            // Read on, as Svelte does.
        }
    }
};

// Svelte's `deep_read_state`, which an action's effect runs on its value: a
// state is read to its end, and any other object only for the states it holds
// at its top, an array not at all. A Python list, tuple or dict is a state
// here, as `$state` is there.
const readState = (value) => {
    if (typeof value !== 'object' || value === null || value instanceof EventTarget) return;

    if (stateOwned(value)) deepRead(value, new Set());
    else if (pyContainer(value)) heldStates(value, new Set());
    else if (Array.isArray(value) || VIEWED.has(value)) return;
    else if (quietPyType(value) === undefined) {
        for (const key in value) if (stateOwned(value[key])) deepRead(value[key], new Set());
    } else {
        for (const one of storedFields(value)) if (stateOwned(one)) deepRead(one, new Set());
    }
};


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
//
// A universal `load()`, in `+page.py`, is handed an event with no request, and
// with the two functions every `load()`'s event carries, `parent` and
// `depends`: taken for none, it reached Python as a `JSObject`, where
// `event["query"]` raised `KeyError`.
const routeEvent = (value) => {
    try {
        const [fetch, url, request, params] = ['fetch', 'url', 'request', 'params'].map((name) => member(value, name));

        if (typeof fetch !== 'function' || !urlish(url) || params === null || typeof params !== 'object') return false;
        if (request === NO_FIELD || request === undefined) {
            return ['parent', 'depends'].every((name) => typeof member(value, name) === 'function');
        }
        if (request === null || typeof request !== 'object') return false;

        const headers = member(request, 'headers');

        return (
            typeof member(request, 'method') === 'string' &&
            headers !== null &&
            typeof headers === 'object' &&
            typeof member(headers, 'get') === 'function'
        );
    } catch {
        return false;
    }
};

// What an object JavaScript hands Python as an argument is to Python
// (`lent.argument`): SvelteKit's request event, as a snapshot of real dicts;
// anything else, as itself.
//
// Taken under the event's own `untrack`, each part read again as Python reads
// its key (`readNoted`): SvelteKit runs a `load()` again when what it read
// changes, and a snapshot reading every part at once ran a layout's `load()`
// at every navigation, where the same `load()` in JavaScript, reading a
// cookie, ran once. A handler's event, which tracks nothing, has no `untrack`.
//
// The params read are those the route declares as well as those it holds: an
// optional one absent, `[[slug]]`, was read by no one, and the navigation that
// gave it ran no `load()`, its page left on the data of the absence.
const ROUTE_PARAM = /\[{1,2}(?:\.\.\.)?([^\]=]+)(?:=[^\]]*)?\]{1,2}/g;

const routeArgument = (value) => {
    if (!routeEvent(value)) return value;

    const untracked = typeof value.untrack === 'function' ? (read) => value.untrack(read) : (read) => read();
    const declared = untracked(() => [...String(value.route?.id ?? '').matchAll(ROUTE_PARAM)].map((one) => one[1]));

    return readNoted(
        untracked(() => routeSnapshot(value, declared)),
        {
            url: () => value.url.href,
            route: () => value.route?.id
        }
    );
};

// The params' dict notes the param Python asks of it, held or not, as
// SvelteKit notes each param read, and every one when Python walks it
// (`keysNoted`). Noted whole as `event["params"]` was read, a layout reading
// its team ran again at each ticket, where SvelteKit's runs when the team does.
const paramsNoted = (value, declared) =>
    keysNoted(
        pyDict(Object.entries({ ...value.params })),
        (key) => Reflect.get(value.params, key),
        () => {
            for (const key of new Set([...Object.keys(value.params), ...declared])) Reflect.get(value.params, key);
        }
    );

// The query's dict notes the key Python asks of it, held or not, as SvelteKit's
// `searchParams.get` notes it, and the whole query when Python walks it
// (`keysNoted`). Noted whole as `event["query"]` was read, a `load()` reading
// `.get("q")` ran again when any other key changed, where SvelteKit's runs when
// `q` does.
const queryNoted = (value, query) =>
    keysNoted(
        pyDict(query),
        (key) => searched(() => value.url.searchParams.get(key)),
        () => searched(() => [...value.url.searchParams])
    );

const searched = (read) => {
    try {
        read();
    } catch {
        // A prerendered page has no query string to depend on.
    }
};

// What a load()'s `event["js"].url` is to Python: a URL of its own over
// SvelteKit's, each read and each write going to SvelteKit's as JavaScript
// makes it. The engine asks every JavaScript object Python meets what it is,
// its `toString`, its `nodeType`, its `constructor` and more, and SvelteKit
// takes any such question of its URL or of its query for a read of the whole
// URL: a load() reading `event["js"].url.searchParams.get("q")` ran again at
// each navigation, where the same read in JavaScript runs it again when `q`
// changes. Made under the event's `untrack`, from the URL as it is.
const TRACKED = new WeakMap();
const SEARCH_OF = new WeakMap();

class LoadUrl extends URL {
    constructor(url) {
        super(url.href);
        TRACKED.set(this, url);
    }

    get searchParams() {
        let search = SEARCH_OF.get(this);

        if (search === undefined) {
            search = new LoadSearch(TRACKED.get(this), Reflect.get(URL.prototype, 'search', this));
            SEARCH_OF.set(this, search);
        }

        return search;
    }

    toString() {
        return TRACKED.get(this).toString();
    }

    toJSON() {
        return TRACKED.get(this).toJSON();
    }
}

for (const part of ['hash', 'host', 'hostname', 'href', 'origin', 'password', 'pathname', 'port', 'protocol', 'search', 'username']) {
    Object.defineProperty(LoadUrl.prototype, part, {
        configurable: true,
        get() {
            return TRACKED.get(this)[part];
        },
        set(next) {
            TRACKED.get(this)[part] = next;
        }
    });
}

class LoadSearch extends URLSearchParams {
    constructor(url, search) {
        super(search);
        TRACKED.set(this, url);
    }

    get size() {
        return TRACKED.get(this).searchParams.size;
    }
}

for (const method of ['append', 'delete', 'entries', 'forEach', 'get', 'getAll', 'has', 'keys', 'set', 'sort', 'toString', 'values', Symbol.iterator]) {
    Object.defineProperty(LoadSearch.prototype, method, {
        configurable: true,
        writable: true,
        value(...rest) {
            return TRACKED.get(this).searchParams[method](...rest);
        }
    });
}

// The event itself for Python, its URL that one.
const loadEvent = (value) => {
    const url = new LoadUrl(value.url);

    return new Proxy(value, {
        get: (target, key) => (key === 'url' ? url : Reflect.get(target, key))
    });
};

const routeSnapshot = (value, declared) => {
    // The framework's own searchParams is tried first, but it throws while
    // prerendering, where a query string cannot exist. Parsing the URL again is
    // the fallback, and it touches nothing SvelteKit guards.
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
    // `.items()`, and a JSObj has neither. A universal `load()`'s event has no
    // method, as its JavaScript event has no request.
    return pyDict([
        ['params', paramsNoted(value, declared)],
        ['query', queryNoted(value, query)],
        ['url', value.url.href],
        ...(value.request === undefined ? [] : [['method', value.request.method]]),
        ['route', value.route && value.route.id],
        // The event itself, for whatever the snapshot does not cover: cookies,
        // fetch, setHeaders. It is a JavaScript object and stays one: a
        // load()'s with its URL Python's own (`loadEvent`), and an action's or
        // an endpoint's, which tracks nothing and has no `untrack`, as it is.
        // Made a proxy too, its URL one Python could not change, an action
        // setting the path it redirects to raised, and a `WeakMap` keyed by
        // the event found nothing of it.
        ['js', typeof value.untrack === 'function' ? loadEvent(value) : value]
    ]);
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
    if (found === null) return __brycomp_pybridge.bound(value);

    const { where } = found;

    // The line of an error is placed by the file its frame is in (`fileLines`),
    // which is not always the component setting the handler: `onclick={store.boom}`
    // runs a `.py`'s function.
    return (...args) => {
        try {
            return schedule(calling(found, args), where);
        } catch (error) {
            throw pyError(error, where);
        } finally {
            flushExports();
        }
    };
}

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

    if (found === null) return __brycomp_pybridge.bound(value);

    const identity = pyHandler(value);
    let attach = ATTACHED.get(identity);

    if (attach === undefined) {
        const { where } = found;

        // Exports flushed as the handler flushes them, before Svelte reads on:
        // a `bytearray` the attachment changed is an export already copied.
        attach = (...args) => {
            try {
                return pyTeardown(calling(found, args), where);
            } catch (error) {
                throw pyError(error, where);
            } finally {
                flushExports();
            }
        };

        ATTACHED.set(identity, attach);
    }

    return attach;
}

// The root an `@effect.root` names, which its name hands Python as the
// destructor. The roots are made after the body has run, since an effect runs
// what the body defines, and the destructor is the name's as soon as its `def`
// has run, as Svelte's `$effect.root` hands it back at once: `stop()` in the
// body, or `saved = stop`, before the root is made. Stopped before it is made,
// it is never made, as Svelte's root stopped at once never runs its effect.
// Stopped while it is made, by an `@effect.pre` its making runs, it is
// destroyed once made, as Svelte's root is: the request was kept, and the
// root ran on, past the component's own unmount.
export function laterRoot() {
    let destroy;
    let stopped = false;

    return {
        stop() {
            if (destroy === undefined) stopped = true;
            else destroy();
        },
        start(make) {
            if (stopped) return;

            destroy = make();
            if (stopped) destroy();
        }
    };
}

// A callback whose answer Svelte does not read, a cleanup, an action's `update`
// and `destroy`, a transition's `tick`: a Python one is called as a handler is,
// its coroutine started and its answer left as it is. Converted for a reader,
// a generator it answered was walked and its body run. A JavaScript one is
// itself (`pyHandler`).
const unreadCall = (value) => (declared(value) === null ? pyHandler(value) : pyEvent(value));

export function pyTeardown(value, where) {
    if (pyAwaitable(value)) {
        schedule(value, where);
        return undefined;
    }

    const cleanup = callable(value) ? unreadCall(value) : undefined;

    return typeof cleanup === 'function' ? () => cleanup() : undefined;
}


// A write from Python to a name `__js__` or `importjs` brings: refused, as
// JavaScript refuses an assignment to an import, with the name and the file.
export function readOnlyImport(name, where) {
    pyRaise(
        'TypeError',
        `'${name}' is a JavaScript import of ${where}, and an import is read-only; ` +
            `bind another name to hold a value of your own`
    );
}

// A write from Python to a prop the compiler saw no write to, which it
// compiled as Svelte compiles a prop its component never writes, with no
// setter: refused, with the prop and the file, and how to write it so that
// the compiler sees the write.
export function readOnlyProp(name, where) {
    pyRaise(
        'TypeError',
        `'${name}' is a prop of ${where} that the compiler saw no write to, so it is read-only; ` +
            `write it by its name, \`${name} = …\` (declared \`global\` in a function)`
    );
}

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
const published = (value) => pyNumbers(__brycomp_pybridge.bound(value));

// Its length is what the function it calls declares: a Python function's
// signature, or a JavaScript function's own `length`, which a decorator may
// have put under the name. Read off the signature alone, a JavaScript
// function's was 0 whatever it took.
const component = (read, where, convert) => {
    const held = read();
    const first = declared(held);

    return identified(
        (...args) => {
            const value = read();
            const found = declared(value) ?? { fn: value, arity: Infinity };

            return running(() => calling(found, args), where, convert);
        },
        nameOf(where),
        first !== null ? arityNow(first.arity) : typeof held === 'function' ? held.length : 0
    );
};

export const pyComponent = (read, where, exported = false) => component(read, where, exported ? published : returned);

// A lifecycle hook, called as a component's function is, its answer handed
// back as Python's: Svelte reads nothing of what `on_destroy` answers, and of
// `on_mount`'s only the cleanup `pyTeardown` finds there. Converted for a
// reader, a generator either answered was walked and its body run.
export const pyHook = (read, where) => component(read, where, null);

// What a store hands JavaScript for one of its names: the value the name holds
// when it is read, for what it is, whatever bound the name. A Python callable
// crosses as every Python callable does, as the one JavaScript function
// published for it (`pyHandler`): a function JavaScript kept is the one it
// read, as one kept from a JavaScript module is, and the one a registry was
// handed when Python passed it, so the registry can remove it; and its answer
// crosses as data, a list as the view that keeps it and tells Svelte of a
// change. Each a wrapper of its own, the store's handed another function than
// the one Python passed, and its answer as a framework's options, a list of
// floats copied anew at each call. A JavaScript function the store holds,
// `importjs` brought, crosses as itself, which `pyHandler` hands back for the
// adapter Python called it through: asked whether a Python signature was
// declared, it crossed as that adapter, its answer a Python object. Anything
// else crosses as a `.py` module hands it over (`pyExport`): a list, a dict or
// an instance as its view, the container the page follows and an instance in
// it read by its attributes, its methods and its `__str__`, and a set, bytes
// or a range as JavaScript's. Handed as itself, a container held instances
// JavaScript could not read and a set had no size. What is a call is
// `callable`'s answer, the one every door asks.
export function storeMember(value) {
    if (callable(value)) return pyHandler(value);

    return pyExport(value);
}

// And what a store's setter hands its name: the instance a view stands for, as
// a call of a Python function finds it again, since the setter assigns with no
// call in between; what a proxy of the store's own stands for (`handedProxy`);
// anything else as an argument crosses, which the name keeps as it keeps what
// Python writes (`storeTrack`).
export function storeValue(value) {
    const node = stoodFor(value);

    if (NODES.has(node)) return node;

    return VIEWED.has(value) ? pyBind(value) : pyArg(value);
}

// How a store's name tracks a value written, by its setter or by Python, a
// function JavaScript called with an array among it. An array or a plain object
// of JavaScript's is a state as Svelte's `$state` is one, and costs what it
// costs there: the store keeps its own copy of the first level, JavaScript
// reads and writes it through a proxy that tells of each change and copies
// each level at its first read (`handedProxy`), as Svelte makes a proxy of each
// at its first read, and Python's first read, by any door, makes it Python's
// own list and dicts (`made`). Made Python's at the write, 50 000 rows cost 200
// ms, where Svelte's cost nothing. One object is one node wherever the store
// holds it, under two names or two parents, as one object is one proxy of
// Svelte's: written through either, it is written for both. One with a getter
// or a setter becomes Svelte's state, as a view makes it (`entering`).
// Anything else as it is, Python's own told first (`ownedByJavascript`): every
// write of a store's name asks, but of the value the name holds already, kept
// as it was written, which `rows += [x]` writes again.
export const storeTrack = (value, bump) => {
    value = NODE_OF.get(value) ?? value;

    // A node the store holds, written under a name or put back after a
    // refusal: its marker alone, what it holds told by its proxy
    // (`trackAlone`).
    if (NODES.has(value)) return trackAlone(value, bump);

    if (value !== bump.held && object(value) && ownedByJavascript(value) && (Array.isArray(value) || plainObject(value))) {
        if (!Array.isArray(value) && behaves(value)) return track(entering(value), bump);

        return trackAlone(nodeOf(value), bump);
    }

    return track(value, bump);
};

// What Python reads of what a store's name holds: what Python made of a node
// (`made`), the name then following that in its place, and anything else as it
// is. JavaScript's read of the name, the store's getter, takes a node as it is
// (`storeShown`).
export const storeHeld = (value, bump) => {
    if (shown || !object(value) || !NODES.has(value)) return value;

    const python = made(value);

    if (bump.held === value) track(python, bump);

    return python;
};

// A store's names as its module holds them now, as Python's `hasattr` answers,
// asked of its `globals()`, which a page asking follows (`namespaceHolds`): a
// name the module deleted, only annotated, or bound in a comprehension of its
// own has a getter of the store, and was a key of it all the same. Its reads
// are the getters' own.
//
// Left out only while JavaScript lets a key be: frozen or sealed, the store
// keeps every key it has, as a frozen object must, where the freeze threw and
// every listing after it. So the keys it left out go first, as it is closed:
// a name only annotated appeared once it was.
export const storeFacade = (members, ns) => {
    const shown = (target, key) =>
        typeof key !== 'string' || !Object.isExtensible(target) || Reflect.getOwnPropertyDescriptor(target, key)?.configurable === false || core.namespaceHolds(ns, key);

    return new Proxy(members, {
        has: (target, key) => (Object.hasOwn(target, key) ? shown(target, key) : Reflect.has(target, key)),
        ownKeys: (target) => Reflect.ownKeys(target).filter((key) => shown(target, key)),
        getOwnPropertyDescriptor: (target, key) => (shown(target, key) ? Reflect.getOwnPropertyDescriptor(target, key) : undefined),
        preventExtensions: (target) => {
            for (const key of Reflect.ownKeys(target)) if (!shown(target, key)) delete target[key];

            return Reflect.preventExtensions(target);
        }
    });
};

// What the store's getter hands JavaScript for one of its names: a node as
// `shownOf` hands it, and anything else as a member.
export const storeShown = (ns, name) => {
    shown = true;

    let value;

    try {
        value = ns[name];
    } finally {
        shown = false;
    }

    return object(value) && NODES.has(value) ? shownOf(value) : storeMember(value);
};

let shown = false;

// The objects the store holds, each JavaScript's array or object copied at its
// first read (`nodeOf`); what Python made of each, at its first read of any of
// them, and the view of it that a proxy JavaScript held reads and writes then;
// and their proxies both ways.
const NODES = new WeakSet();
const MADE = new WeakMap();
const MADE_VIEW = new WeakMap();
const PROXY_OF = new WeakMap();
const NODE_OF = new WeakMap();

// Python's own of a node and of what it holds, made once, at Python's first
// read of it by any door: the walk `pyData` makes, recording what it made of
// each node for every other root that holds it, and one value for each place of
// an array or object JavaScript has not read yet, as JavaScript's first read of
// a place copies it: two places holding one object are two copies, as Svelte's
// are, whoever reads first, and only one the walk is inside of, a cycle, is the
// one value (`leave`). Shared by the walk, an object met twice made what a
// Python write reached hang on what a page had read.
//
// Each node JavaScript read is then told of a change Python makes to what it
// was made into, so a page that read it before reads what Python writes, and
// its proxy is what Python hands for it from now on (`handedAs`), whatever
// hands it, the getter, a function's result, a list Python made anew: the same
// row to a page that keyed on it. Handed the view instead, a page saw another
// object after a mere `len(rows)` in Python, and an `{#each}` keyed by the row
// made its field again, what was typed in it gone.
const made = (node) => {
    const known = MADE.get(node);

    if (known !== undefined) return known;

    const inside = new Map();
    const python = pyData(
        node,
        {
            get: (one) => MADE.get(one) ?? inside.get(one),
            set: (one, it) => (NODES.has(one) ? MADE : inside).set(one, it),
            leave: (one) => inside.delete(one)
        },
        true
    );
    const pending = [node];
    const seen = new Set();

    while (pending.length > 0) {
        const one = pending.pop();

        if (seen.has(one)) continue;
        seen.add(one);

        if (MARKS.has(one)) inherit(one, MADE.get(one), undefined, true);

        const proxy = PROXY_OF.get(one);

        if (proxy !== undefined && !MADE_VIEW.has(one)) MADE_VIEW.set(one, handedAs(MADE.get(one), proxy));

        for (const child of Array.isArray(one) ? one : Object.values(one)) if (NODES.has(child)) pending.push(child);
    }

    return python;
};

// What JavaScript is handed for a node: its proxy, made until Python makes the
// node its own, and then what Python hands for what it made, that same proxy if
// JavaScript held one.
const shownOf = (node) => {
    const proxy = PROXY_OF.get(node);

    if (proxy !== undefined) return proxy;

    const python = MADE.get(node);

    return python === undefined ? handedProxy(node) : viewOf(python);
};

// The node a store holds for JavaScript's array or object, its first level
// copied, a proxy of the store's found in it standing for its own node.
const nodeOf = (one) => {
    const node = copyOf(one);

    NODES.add(node);

    return node;
};

const stoodFor = (one) => NODE_OF.get(one) ?? one;

// An array or a plain object of JavaScript's that a store copies: no view or
// proxy of the store's, and none of Python's.
const javascriptData = (one) =>
    object(one) &&
    !VIEWED.has(one) &&
    !NODE_OF.has(one) &&
    ownedByJavascript(one) &&
    (Array.isArray(one) || (plainObject(one) && !behaves(one)));

// The first level of an array or a plain object, its prototype kept: what the
// store holds of it, so that what it was handed changes nothing the store
// holds, and nothing written through the store changes what it was handed.
const copyOf = (one) => {
    // Each place an array holds, a hole left one: written at every index, the
    // copy held `undefined` where the array held nothing, and `forEach` and `in`
    // found it. Only an `undefined` is asked whether it is held.
    if (Array.isArray(one)) {
        const copy = new Array(one.length);

        for (let at = 0; at < one.length; at++) {
            const item = one[at];

            if (item !== undefined || at in one) copy[at] = stoodFor(item);
        }

        return copy;
    }

    const copy = Object.create(Object.getPrototypeOf(one));

    for (const key of Reflect.ownKeys(one)) if (Object.prototype.propertyIsEnumerable.call(one, key)) put(copy, key, stoodFor(one[key]));

    return copy;
};

const put = (into, key, value) => {
    if (key === '__proto__') Object.defineProperty(into, key, { value, writable: true, enumerable: true, configurable: true });
    else into[key] = value;
};

// The proxy of a node, the same each time, and the node's marker, which a read
// through the proxy follows and a write through it tells, as each proxy of
// Svelte's has its signals: a page that read the node hears of it, under
// whatever name or parent it read it. Made without a walk of what the node
// holds, and held by nothing until something reads it.
const handedProxy = (node) => {
    let proxy = PROXY_OF.get(node);

    if (proxy === undefined) {
        if (!MARKS.has(node)) mark(node, false);

        proxy = new Proxy(node, HANDED_TRAPS);
        PROXY_OF.set(node, proxy);
        NODE_OF.set(proxy, node);
    }

    return proxy;
};

// A write through a proxy, told to the node's readers: as Svelte's state,
// refused before anything is written where Svelte refuses a write.
const changing = (node, write) => {
    const marker = MARKS.get(node);

    if (marker !== undefined && host.refuses()) marker();

    const done = write();

    if (marker !== undefined) marker();

    return done;
};

// What the proxy reads: a node, as `shownOf` hands it; JavaScript's array or
// object not read yet, copied first, in place; anything else as it is. Once
// Python has made a node its own, each operation goes to the view of what it
// made, so that a proxy JavaScript kept writes what Python reads.
const HANDED_TRAPS = {
    get(node, key) {
        const view = MADE_VIEW.get(node);

        if (view !== undefined) return Reflect.get(view, key);

        follow(node);

        const value = Reflect.get(node, key);

        if (NODES.has(value)) return shownOf(value);
        if (!javascriptData(value)) return value;

        const copy = nodeOf(value);

        put(node, key, copy);

        return handedProxy(copy);
    },
    set(node, key, given) {
        const view = MADE_VIEW.get(node);

        if (view !== undefined) return Reflect.set(view, key, given);

        const value = stoodFor(given);

        return changing(node, () => Reflect.set(node, key, value));
    },
    deleteProperty(node, key) {
        const view = MADE_VIEW.get(node);

        if (view !== undefined) return Reflect.deleteProperty(view, key);

        return changing(node, () => Reflect.deleteProperty(node, key));
    },
    defineProperty(node, key, descriptor) {
        const view = MADE_VIEW.get(node);

        if (view !== undefined) return Reflect.defineProperty(view, key, descriptor);

        const given = 'value' in descriptor ? { ...descriptor, value: stoodFor(descriptor.value) } : descriptor;

        return changing(node, () => Reflect.defineProperty(node, key, given));
    },
    has(node, key) {
        const view = MADE_VIEW.get(node);

        if (view !== undefined) return Reflect.has(view, key);

        follow(node);

        return Reflect.has(node, key);
    },
    ownKeys(node) {
        const view = MADE_VIEW.get(node);

        if (view !== undefined) return Reflect.ownKeys(view);

        follow(node);

        return Reflect.ownKeys(node);
    },
    getOwnPropertyDescriptor(node, key) {
        const view = MADE_VIEW.get(node);

        if (view !== undefined) return Reflect.getOwnPropertyDescriptor(view, key);

        follow(node);

        return Reflect.getOwnPropertyDescriptor(node, key);
    }
};

// What a proxy of the store's stands for in Python, wherever Python first meets
// it: what Python made of its node.
readsAsPython((one) => {
    const node = NODE_OF.get(one);

    return node === undefined ? undefined : made(node);
});

// And what an instance's `@export` hands JavaScript, the value its name holds
// as each binding of the name hands it over (`liveExport`): the one function
// published for a callable, as a store's, and a JavaScript function as itself;
// a deleted name is `undefined`, and a value a decorator made of the `def`
// crosses as data.
export function exportedMember(value) {
    if (value === undefined) return undefined;

    return callable(value) ? pyHandler(value) : published(value);
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
    return alone === undefined ? listed(value) : alone;
};

// The `value` of a control a `bind:group` binds is read by the group alone,
// which compares it as Python does (`group`), while the field shows its text. A
// value only itself is equal to, a NaN or an instance of a subclass of float,
// int or str, would be another value once made JavaScript's: it is handed over
// as a boxed scalar, one per value, which shows the same text and which the
// group takes back as the value it stands for.
const CHOICES = new WeakMap();
const CHOSEN = new WeakMap();

const choice = (value) => {
    // A JavaScript scalar, a NaN among them, is its own value already.
    if (value === null || typeof value !== 'object') return value;

    const alone = scalarOnly(value);

    if (alone === value) return alone;

    const plain = isExactScalar(value) || value instanceof String;

    if (plain && alone === alone) return alone;

    let box = CHOICES.get(value);

    if (box === undefined) {
        box = Object(alone);
        CHOICES.set(value, box);
        CHOSEN.set(box, value);
    }

    return box;
};

// What Svelte compares crosses into JavaScript as everything else does: a value
// that is a number is its number, a NaN and an instance of a subclass of float,
// int or str among them, as a JavaScript child is handed it. A list's items are
// read by index, as Svelte's `includes` reads them (`byIndex`), each as an
// option's value is: a None the `undefined` an option's None is, a
// `javascript.NULL` the `null` an option's NULL is.

const COMPARED = {
    scalar: scalarOnly,
    selection: (value) => (Array.isArray(value) ? byIndex(value, scalarOnly) : scalarOnly(value)),
    choice
};

// What Python reads again is handed back as it is, None included: called from
// JavaScript, a Python function gives `undefined` for None. A prop handed to a
// Python child (`'child'`) is handed as it comes, None the `undefined` a Svelte
// prop reads its default for.
const keptPython = (value) => (value === undefined ? NONE : value);
const handedPython = (value) => (value === NONE ? undefined : value);
// What the write half of a binding answers is nobody's, a coroutine's result
// too: Svelte calls the setter and reads nothing back. Converted for a reader,
// a generator it answered was walked and its body run.
const unread = () => undefined;

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
                writes ? unread : kept === true ? keptPython : kept === 'child' ? handedPython : (COMPARED[kept] ?? pyNumbers)
            ),
        nameOf(where),
        arity
    );

// What a route's `load()` answers, as SvelteKit reads it: a plain object at the
// top level, its values what they are. A dict crosses as its view, whose
// prototype keeps Svelte's proxy off it (Bryntime's `PLAIN_VIEW`), and the dev
// server's own check, by identity, answered 500 to every `load()` returning
// one. A dict's view alone is made one: anything else a `load()` answers is
// SvelteKit's to judge. What it answers later, a promise, another realm's or
// JavaScript's own thenable among them, is awaited first and its answer made
// one: a copy made before answered `{}`, and a thenable a JavaScript helper made
// of what a Python callback answered was the view, which SvelteKit refused.
//
// And the transport writes the dict itself (`TOPS`), its keys, their types and
// their order Python's. Its plain object says where its values came from
// (`markTop`), as the browser's copy of it does, under a symbol SvelteKit's
// merge carries: a Python page reads them back as the dict held them
// (`routeData`). Each one, and not only one whose plain object cannot say what
// the dict held: a page's `1` over its layout's `1.0` reads in JavaScript as
// the `1.0` did, and the page, saying nothing, was read the layout's float.
const TOPS = new WeakMap();

const plainTop = (data, server = false) => {
    if (!VIEWED.has(data)) return data;

    const dict = pyBind(data);

    if (!isDict(dict)) return data;

    const spread = { ...data };
    const items = pyEntries(dict);
    // What the spread left of each value, what the page reads and what
    // crosses: an iterator its view used up is the list the view made of it
    // (`readBack`); a coroutine is itself, whose promise the transport streams.
    const left = items.map(([key, value]) => (pyAwaitable(value) ? value : readBack(value, spread[propertyKey(key)])));
    const crosses = left.some((value, at) => value !== items[at][1]) ? pyDict(items.map(([key], at) => [key, left[at]])) : dict;

    if (!server) return topOf(crosses, spread);

    // The data of a server's `load()` for a page it renders: the page reads
    // there too what the browser reads (`crossing`), the dict itself where its
    // copy could not differ, and what pickle refuses is refused here, in its
    // words, as SvelteKit writes every node's data.
    const { copy, structure } = crossing(crosses, false, true);

    return topOf(copy, { ...viewOf(copy) }, structure);
};

const topOf = (dict, pojo, structure) => {
    const items = pyEntries(dict);
    const entries = items.map(([key, value]) => {
        const name = propertyKey(key);
        const js = pojo[name];

        // A coroutine's promise is what any reader of it holds.
        return [name, key, pyAwaitable(value) ? js : value, js];
    });
    TOPS.set(pojo, { dict, structure, names: entries.map(([name]) => name) });

    return markTop(pojo, { entries: () => entries });
};

// A route's `data` as its Python page reads it, a dict: what each node's
// `load()` returned, merged in SvelteKit's order as `{**layout, **page}` merges
// them, each value the one its dict held where the merge kept it, and a node's
// in JavaScript read as any value JavaScript hands Python. Nothing in the
// merged object says what a node in JavaScript wrote, so two things are not
// as Python merges them: a value it writes over a Python node's that reads in
// JavaScript as the Python one did, `1` over a layout's `1.0`, is the Python
// one; and the names of a layout in JavaScript come after its Python page's.
// One dict per merged object, which `page.data` read from Python is too.
const ROUTE_DATA = new WeakMap();

export const routeData = (data) => {
    if (data === null || typeof data !== 'object' || VIEWED.has(data)) return pyBind(data);

    const known = ROUTE_DATA.get(data);

    if (known !== undefined) return known;

    // Every key the dicts hold, written in their order, and what JavaScript read
    // of the last one each name held: the dict made of them keeps the place of a
    // key's first writer and the value of its last, as `{**a, **b}` does, `1.0`
    // and `1` one key, and two keys JavaScript names alike, `1` and `"1"`, two,
    // where the last one's name took the other's place. Each write, and not a
    // `Map` of them, which tells `True` and `1` apart: the page's `True` went to
    // the root's place, and the nested layout's `1`, after it, was the last.
    //
    // Only what the merged object still holds: a `load()` of JavaScript's that
    // leaves a key out returns a copy, which carries the symbol along, and the
    // key left out came back. Left out with an earlier node's key of its name in
    // the merge, it is told by its value, which is not the one the merge holds
    // while that earlier key's is: past the last write of a name the merge
    // holds the value of, a write of that name was left out. One leaving out
    // the very value an earlier node gives leaves the merge as keeping it
    // would, and is read as kept.
    const entries = origins(data).flatMap((origin) => origin.entries());
    const shown = new Map();

    entries.forEach(([name, , , js], at) => {
        if (Object.hasOwn(data, name) && Object.is(data[name], js)) shown.set(name, at);
    });

    const named = new Map();
    const writes = [];

    for (const [at, [name, key, value, js]] of entries.entries()) {
        if (!Object.hasOwn(data, name) || at > (shown.get(name) ?? Infinity)) continue;

        writes.push([key, value]);
        named.set(name, js);
    }

    // And what a node in JavaScript wrote, a string key, after them.
    for (const name of Object.keys(data)) {
        if (!(named.has(name) && Object.is(data[name], named.get(name)))) writes.push([name, pyBind(data[name])]);
    }

    const dict = pyDict(writes);

    ROUTE_DATA.set(data, dict);
    ADOPTED.add(data);
    standsForPython(data, () => dict);

    return dict;
};

// Read from Python wherever Python meets it, `page.data` before the page's own
// `data` among them, SvelteKit's merge is the same dict.
readsAsPython((object) => (origins(object).length > 0 ? routeData(object) : undefined));

// The modules SvelteKit keeps out of the browser, as each says when it runs
// (`serverModule`): what they define is refused by name at the transport.
const SERVER_MODULES = new Set();

const refusedModule = (module) =>
    SERVER_MODULES.has(module)
        ? `svelthon — \`${module}\` is a module of the server alone, which the browser never imports: what it ` +
          `defines cannot cross to the page by its name; define it in a module the page imports`
        : undefined;

// What SvelteKit's `transport` hands the codec (`transport.js`): one memo per
// serialisation, which runs at once, so an object two parts of the data hold is
// one object at the other end.
const OURS = new WeakSet();
const ours = (...items) => (OURS.add(items), items);
let serialising = null;
let HELD = null;
let FREE_NOW = null;
let WRITTEN = null;

const serialisation = () => {
    if (serialising !== null) return;

    serialising = new Map();
    HELD = new WeakMap();
    FREE_NOW = [];
    WRITTEN = new WeakMap();
    queueMicrotask(() => {
        serialising = null;
        HELD = null;
        FREE_NOW = null;
        WRITTEN = null;
    });
};

const pickledFor = (value) => {
    serialisation();

    try {
        return pickled(value, { memo: serialising, refused: refusedModule, crossed: FRESH_REBUILT });
    } catch (error) {
        throw pyError(error, 'the data handed to the browser');
    }
};

// What a page reads of a value that crosses to it, on the server as in the
// browser, and what crosses for it (Bryntime's `roundTrip`): the value pickle
// carries, rebuilt here from the very structure the transport then writes for
// it (`CROSSING`), which the browser rebuilds the same. Where pickle will not
// carry it, a `lenient` caller keeps the value itself: a remote function's,
// which a page that ships no JavaScript never hands over.
//
// A caller that keeps the structure on an object of its own, made for that
// one crossing, the data of a `load()`, may `keep` the value itself where its
// copy could not differ from it, as SvelteKit hands its page the data of a
// JavaScript `load()`: that value, a store a module holds among them, is no
// copy, and the structure of one crossing is not its own.
const CROSSING = new WeakMap();

// And each instance of a copy that a reduction or the author's code rebuilt,
// the node it was rebuilt from (`REBUILT`), which it crosses as wherever it
// crosses again: a remote function's answer a JavaScript `load()` returns was
// rebuilt again from the copy, its reduction run twice. Only those: any other
// copy is pickled as it is then, a change made to it since included.
const REBUILT = new WeakMap();

// Each structure kept beside what its copy held as it was rebuilt (`print`,
// read off its storage by `statePrint`), and taken again only while the copy
// holds the same: a `load()` that wrote to the answer it was handed saw its
// write lost in the browser, which rebuilt the answer as it was. A copy changed
// since crosses as it is then. Read without the author's code: pickled again
// for the print, a reduction that moves a counter moved it in the answer the
// page then read.
const remember = (map, copy, structure) => {
    map.set(copy, { structure, print: statePrint(copy) });
};

const remembered = (map, copy) => {
    const kept = map.get(copy);

    return kept !== undefined && sameStructure(statePrint(copy), kept.print) ? kept.structure : undefined;
};

// Alike, and shared alike: each object of one print stands for one object of
// the other, both ways. Asked one way, two labels a `load()` took apart, or
// one it made of two, read alike, and the browser rebuilt the sharing before
// the write.
const sameStructure = (one, other, forth = new Map(), back = new Map()) => {
    if (Object.is(one, other)) return true;
    if (!Array.isArray(one) || !Array.isArray(other) || one.length !== other.length) return false;
    if (forth.has(one) || back.has(other)) return forth.get(one) === other && back.get(other) === one;
    forth.set(one, other);
    back.set(other, one);
    return one.every((part, at) => sameStructure(part, other[at], forth, back));
};

const FRESH_REBUILT = { get: (copy) => remembered(REBUILT, copy) };

const crossing = (value, lenient = false, keep = false) => {
    if (value === null || typeof value !== 'object') return { copy: value };

    const kept = remembered(CROSSING, value);

    if (kept !== undefined) return { copy: value, structure: kept };

    let made;

    try {
        made = roundTrip(value, { refused: refusedModule, keep, crossed: FRESH_REBUILT });
    } catch (error) {
        if (lenient) return undefined;
        throw pyError(error, 'the data handed to the browser');
    }
    if (!made.kept && made.copy !== null && typeof made.copy === 'object') remember(CROSSING, made.copy, made.structure);
    for (const [copy, structure] of made.rebuilt) remember(REBUILT, copy, structure);

    return made;
};

// What a structure stands for, or `UNLOADED` when it names a module no code of
// the page has evaluated yet, and `lenient` lets the caller read a copy first:
// a page in JavaScript, which never imports a module of Python, or one decoded
// before SvelteKit has loaded the page's modules.
//
// Rebuilt outside any reaction, though the first read is often a template's:
// rebuilding reads and writes what nobody holds yet, and a `__setstate__` that
// filled its instance through `self.__dict__.update(...)` was a write Svelte
// refused there (`state_unsafe_mutation`), the page in the browser an error.
const UNLOADED = Symbol('svelthon.unloaded');

const unpickledFor = (value, lenient = false, trusted = false) => {
    let missing;

    try {
        return untrack(() =>
            unpickled(value, {
                restricted: !BROWSER && !trusted,
                missing: (module) => {
                    missing = module;
                }
            })
        );
    } catch (error) {
        if (lenient && missing !== undefined) return UNLOADED;
        throw pyError(error, BROWSER ? 'the data the server handed' : 'the value the browser sent');
    }
};

// The names a dict's keys take as a plain object's properties, a view's own.
const namesOf = (dict) => pyEntries(dict).map(([key]) => propertyKey(key));

const object = (one) => one !== null && typeof one === 'object';

// The Python value what JavaScript holds stands for, if it stands for one: a
// view, a copy of bytes, an object standing for one. A JavaScript function is
// no door's, and stays JavaScript's; and a container of JavaScript's own is
// none either, unless one was made to stand for a value (`ADOPTED`), asked of
// no one: walking a JavaScript `load()`'s ten thousand rows, asking each one
// cost it 60 % more. The serialiser reads what a view holds, and the view of an
// iterable made as it goes stands for its list from then on (`listedNow`).
const ADOPTED = new WeakSet();

const pythonOf = (thing) => {
    if (!object(thing) && !VIEWED.has(thing)) return undefined;
    if (containerOf(thing) && !ADOPTED.has(thing)) return undefined;

    listedNow(thing);

    const python = pyBind(thing);

    return quietPyType(python) === undefined ? undefined : python;
};

// JavaScript's own containers holding Python values at any depth, a `load()`
// of JavaScript's returning `{ one, nested: { two } }`: SvelteKit writes each
// value it encodes apart, and what two of them share came out two copies. The
// outermost container holding two, SvelteKit's own envelope of a node's data
// aside, crosses whole instead (`grouped`): its shape, each container made
// again as SvelteKit's serialiser makes it (`kindOf`), around one Python list
// of the values, pickled together. Not one holding what crosses as its own
// whole, the data of a `load()`, an action's answer, SvelteKit's merge.
const containerOf = (one) => object(one) && !VIEWED.has(one) && !OURS.has(one) && !thenable(one) && kindOf(one) !== undefined;

// One the application's own transport writes (`'x'`), asked first, as
// SvelteKit asks its transporters before devalue writes anything; an array, a
// Map or a Set, a subclass of one as devalue writes it; a plain object, or one
// with no prototype (`'O'`).
const kindOf = (one) => {
    if (written(one) !== undefined) return 'x';
    if (Array.isArray(one)) return 'a';
    if (one instanceof Map) return 'm';
    if (one instanceof Set) return 's';

    const prototype = Object.getPrototypeOf(one);

    return prototype === Object.prototype ? 'o' : prototype === null ? 'O' : undefined;
};

// What the first of the application's transporters that writes an object makes
// of it, with its key, asked once per serialisation (`WRITTEN`).
const written = (one) => {
    const given = transporters();

    if (given.length === 0) return undefined;

    let found = WRITTEN?.get(one);

    if (found === undefined) {
        found = null;
        for (const [key, { encode }] of given) {
            const made = encode(one);

            if (made) {
                found = [key, made];
                break;
            }
        }
        WRITTEN?.set(one, found);
    }

    return found ?? undefined;
};

const kitEnvelope = (one) => !Array.isArray(one) && one.type === 'data' && Object.hasOwn(one, 'uses');

const partsOf = (one, kind = kindOf(one)) =>
    kind === 'x' ? [written(one)[1]] : kind === 'a' ? one : kind === 'm' ? [...one].flat() : kind === 's' ? [...one] : Object.values(one);

const crossesWhole = (one) => TOPS.has(one) || ANSWERS.has(one) || origins(one).length > 0;

// What a container holds, two Python values at most and whether it holds what
// crosses whole, once per serialisation (`HELD`). The containers of a cycle all
// hold what any of them holds: one met again within its own asking takes in
// each container asked since (`join`), and they read what it holds, whatever
// the order the cycle was made in.
//
// The data of a JavaScript `load()`, walked as it returns, is not walked again
// as SvelteKit writes it: what that walk found holding none, outside a cycle,
// it marks (`marking`) for the writing of that data alone, kept on an object
// made for that `load()` (`crossedData`) and taken up by the serialisation
// that meets it (`FREE_NOW`). Marked for good, a store a `load()` returns at
// each request, empty at first and filled later, crossed as it was first seen.
const FREE_AFTER_LOAD = new WeakMap();
let marking = null;

const isFree = (one) => {
    const free = FREE_AFTER_LOAD.get(one);

    if (free !== undefined) {
        FREE_AFTER_LOAD.delete(one);
        serialisation();
        FREE_NOW.push(free);
    }

    return FREE_NOW !== null && FREE_NOW.some((set) => set.has(one));
};

// The containers being asked, outermost first.
const ASKING = [];

const joinedInto = (found) => {
    while (found.into !== undefined) found = found.into;
    return found;
};

const join = (found, into) => {
    found = joinedInto(found);
    if (found === into) return;
    found.into = into;
    if (found.whole) into.whole = true;
    for (const value of found.python) if (into.python.size < 2) into.python.add(value);
};

const heldIn = (one) => {
    if (marking === null && isFree(one)) return NOTHING_HELD;

    let found = HELD.get(one);

    if (found !== undefined) {
        if (!found.done) {
            const into = joinedInto(found);

            into.cycled = true;
            for (const asked of ASKING.slice(ASKING.indexOf(found) + 1)) join(asked, into);
        }
        return joinedInto(found);
    }
    HELD.set(one, (found = { python: new Set(), whole: false, done: false, cycled: false }));
    ASKING.push(found);

    try {
        for (const part of partsOf(one)) {
            if (!object(part)) continue;
            if (crossesWhole(part)) {
                joinedInto(found).whole = true;
                continue;
            }

            const python = pythonOf(part);
            const inner = python === undefined && containerOf(part) ? heldIn(part) : undefined;
            const held = joinedInto(found);

            if (inner?.whole) held.whole = true;
            if (inner?.cycled) held.cycled = true;
            for (const value of python === undefined ? (inner?.python ?? []) : [python]) {
                if (held.python.size < 2) held.python.add(value);
            }
        }
    } finally {
        ASKING.pop();
    }

    found.done = true;
    if (found.into === undefined && !found.cycled && !found.whole && found.python.size === 0) marking?.add(one);

    return joinedInto(found);
};

const NOTHING_HELD = Object.freeze({ python: new Set(), whole: false, done: true, cycled: false });

// A container's shape, each container that holds Python values a node of its
// kind, each Python value its place in the list of the values, anything else
// JavaScript's own, a whole that crosses by itself among them, and a hole of
// an array a hole (`'h'`).
const shapeOf = (one) => {
    const values = [];
    const places = new Map();
    const shapes = new Map();
    const shape = (container) => {
        let made = shapes.get(container);

        if (made !== undefined) return made;
        const kind = kindOf(container);

        made = ours(kind);
        shapes.set(container, made);

        const part = (child) => {
            const python = object(child) && !crossesWhole(child) ? pythonOf(child) : undefined;

            if (python !== undefined) {
                if (!places.has(python)) places.set(python, values.push(python) - 1);
                return ours('@', places.get(python));
            }

            return containerOf(child) && heldIn(child).python.size > 0 ? shape(child) : ours('j', child);
        };

        if (kind === 'x') {
            const [key, form] = written(container);

            made.push(key, part(form));
        } else if (kind === 'a') for (let at = 0; at < container.length; at++) made.push(at in container ? part(container[at]) : ours('h'));
        else if (kind === 'm') for (const [key, value] of container) made.push(part(key), part(value));
        else if (kind === 's') for (const value of container) made.push(part(value));
        else for (const [name, value] of Object.entries(container)) made.push(name, part(value));

        return made;
    };

    return { root: shape(one), values };
};

const grouped = (one) => {
    const { root, values } = shapeOf(one);

    return ours('J', root, pickledFor(pyList(values)));
};

// What a JavaScript server module's `load` returns, where it holds Python
// values, its page reads on the server as the browser reads it: the same
// shape around their copies, or around the values themselves where no copy
// could differ (`crossing`), crossing as one group (`CROSSED_GROUPS`), the
// structure they were rebuilt from. Walked as it is at each return, whatever an
// earlier walk found; and where it holds none, made again for that `load()`
// alone, the object the marks of that walk are kept on (`FREE_AFTER_LOAD`).
const CROSSED_GROUPS = new WeakMap();

const crossedData = (data, event) => {
    if (event?.isDataRequest === true) return data;
    // The data itself a dict of Python's: as the data of a Python `load()`.
    if (VIEWED.has(data)) return plainTop(data, true);
    if (!containerOf(data) || crossesWhole(data)) return data;

    serialisation();

    const free = new WeakSet();
    const outer = [HELD, marking];
    let shape;

    [HELD, marking] = [new WeakMap(), free];

    try {
        if (heldIn(data).python.size > 0) shape = shapeOf(data);
    } finally {
        [HELD, marking] = outer;
    }

    if (shape === undefined || shape.values.length === 0) return free.has(data) ? ownData(data, free) : data;

    const { copy, structure } = crossing(pyList(shape.values), false, true);
    const made = rebuilt(shape.root, [...copy].map((one) => pyExport(one)));

    CROSSED_GROUPS.set(made, ours('J', shape.root, structure));
    FREE_AFTER_LOAD.set(made, free);

    return made;
};

// The data of one `load()` as a plain object of its own, which SvelteKit's
// merge spreads anyway.
const ownData = (data, free) => {
    if (Array.isArray(data) || data instanceof Map || data instanceof Set) return data;

    const made = Object.assign(Object.create(Object.getPrototypeOf(data)), data);

    free.add(made);
    FREE_AFTER_LOAD.set(made, free);

    return made;
};

// What the codec throws, SvelteKit reads where in the data it was, as it
// reads devalue's own errors: a refusal of ours had no such place, and the
// page's request logged that `path` was undefined, the refusal itself lost.
const placed = (encode) => (thing) => {
    try {
        return encode(thing);
    } catch (error) {
        if (object(error) && error.path === undefined) error.path = '';
        throw error;
    }
};

const codec = {
    UNLOADED,
    // A dict met at the serialiser's own level, the data of a `load()`
    // (`TOPS`), an action's answer, a remote function's, crosses as a plain
    // object of its names (`'p'`), marked when the data of a `load()` says
    // where its values came from (`plainTop`); a copy a door made, as the
    // structure it was rebuilt from (`CROSSING`).
    encode: placed((thing) => {
        if (isFree(thing) || OURS.has(thing) || pickleNode(thing) || thenable(thing)) return undefined;

        // An action's answer, pickled as it was returned (`routeActions`).
        const answer = ANSWERS.get(thing) ?? CROSSED_GROUPS.get(thing);

        if (answer !== undefined) return answer;

        const top = TOPS.get(thing);

        if (top !== undefined) return ours('p', top.names, top.structure ?? pickledFor(top.dict), 1);

        // A merge of marked data, SvelteKit's `parent()` handed on: the dict a
        // Python page reads of it (`routeData`), whose symbols devalue refuses.
        if (object(thing) && !VIEWED.has(thing) && origins(thing).length > 0) {
            const dict = routeData(thing);

            return ours('p', namesOf(dict), pickledFor(dict));
        }

        // What a JavaScript reader was handed for a Python value is that value.
        const python = pythonOf(thing);

        if (python !== undefined) {
            const structure = remembered(CROSSING, python) ?? pickledFor(python);
            const made = isPlainDict(python) ? ours('p', namesOf(python), structure) : structure;

            return Array.isArray(made) ? made : ours('=', made);
        }

        if (!containerOf(thing) || kitEnvelope(thing)) return undefined;

        serialisation();

        const held = heldIn(thing);

        return !held.whole && held.python.size >= 2 ? grouped(thing) : undefined;
    }),
    crossedData,
    // The Python value, and what JavaScript reads of it: a group's shape
    // JavaScript's own, around what JavaScript reads of its values.
    decodeValue(made, lenient, trusted) {
        if (Array.isArray(made) && made[0] === 'J') {
            const values = unpickledFor(made[2], lenient, trusted);

            return values === UNLOADED ? UNLOADED : rebuilt(made[1], [...values].map((one) => pyExport(one)));
        }

        return unpickledFor(Array.isArray(made) && made[0] === '=' ? made[1] : made, lenient, trusted);
    },
    decode(made, lenient, trusted) {
        const value = this.decodeValue(made, lenient, trusted);

        return value === UNLOADED || (Array.isArray(made) && made[0] === 'J') ? value : pyExport(value);
    },
    // A top: its dict, and the values its plain object holds, read off its
    // view as on the server (`plainTop`), each at its first read: Python,
    // reading the dict first, finds an iterator where it stood, and one a
    // JavaScript reader used up first, the list that reader holds (`readBack`).
    decodeTop(names, made, lenient, trusted) {
        const dict = unpickledFor(made, lenient, trusted);

        if (dict === UNLOADED) return undefined;

        const view = viewOf(dict);
        const items = pyEntries(dict);
        const forms = new Map();
        const value = (at) => {
            if (!forms.has(at)) forms.set(at, view[names[at]]);

            return forms.get(at);
        };
        const held = (at) => (forms.has(at) ? readBack(items[at][1], forms.get(at)) : items[at][1]);
        let filling = false;

        return {
            value,
            entries: () =>
                items.map(([key], at) => {
                    const js = value(at);

                    return [names[at], key, held(at), js];
                }),
            // With what JavaScript left of the plain object (`edits`), written
            // in the dict itself: a value it wrote in its entry's place, an
            // entry it deleted taken out, a name it added after the entries. A
            // value leading back to this answer, itself or through another
            // one, reads the dict being written, as a cycle the server made
            // reads the dict.
            dict: (left) => {
                if (filling) return dict;

                filling = true;
                try {
                    items.forEach(([key, one], at) => {
                        const edit = left?.entries[at];

                        if (edit === null) delete view[names[at]];
                        else if (edit !== undefined) pySetitem(dict, key, pyBind(edit.value));
                        else if (held(at) !== one) pySetitem(dict, key, held(at));
                    });
                    for (const [name, value] of left?.added ?? []) pySetitem(dict, name, pyBind(value));
                } finally {
                    filling = false;
                }

                return dict;
            }
        };
    },
    // A plain object Python reads as the value it stands for.
    adopt(object, python) {
        ADOPTED.add(object);
        standsForPython(object, python);
    }
};

globalThis[Symbol.for('svelthon.codec')] = codec;
codecLoaded();

// A route module's `load` as each binding of the name hands it over
// (`liveExport`), which SvelteKit reads off the module at each request, as a
// JavaScript module's `export let load`: a module that binds the name again,
// `global load; load = second`, has its new one called, and one that binds it
// to None has none until it binds a function. One per function, as `pyExport`
// keeps one: the same function bound again, or bound back, is the same object
// to JavaScript. Another object than the one
// the same function is exported as elsewhere, by the module that defines it or
// under another name, since what it answers SvelteKit is a plain object and
// theirs a dict's view, which Svelte must not proxy.
const ROUTE_LOADS = new WeakMap();
const SERVER_LOADS = new WeakMap();

export const routeLoad = (value, where, server = false) => {
    const load = pyExport(value, where);

    if (typeof load !== 'function') return load;

    const relays = server ? SERVER_LOADS : ROUTE_LOADS;
    let relay = relays.get(load);

    if (relay === undefined) {
        relay = identified(
            (...args) => {
                const data = load(...args);
                // No page renders for a data request, which SvelteKit answers
                // with the data alone.
                const top = (one) => plainTop(one, server && args[0]?.isDataRequest !== true);

                return thenable(data) ? Promise.resolve(data).then(top) : top(data);
            },
            load.name,
            load.length
        );
        relays.set(load, relay);
    }

    return relay;
};

// A server module's `load`, whose data crosses to the browser (`plainTop`).
export const routeServerLoad = (value, where) => routeLoad(value, where, true);

// One of JavaScript's that `__js__` brings into a Python server module, read
// where it is bound at each call and relayed as a JavaScript server module's
// (`liveLoad`).
export const jsServerLoad = liveLoad;

// A route module's `actions` as SvelteKit calls them, each answer pickled as it
// returns: SvelteKit writes a `load()`'s data before it renders the page, and
// an action's answer after, once the page has read it, an iterator it walked
// used up by then. The page reads, on the server too, the answer as the
// browser reads it (`crossing`), the one a `fail()` holds as well. Each action
// is the module's own at every call, one relay per function.
const ANSWERS = new WeakMap();
const ACTION_RELAYS = new WeakMap();

const answered = (answer) => {
    const failure = object(answer) && !VIEWED.has(answer) && pythonOf(answer.data) !== undefined;
    const python = pythonOf(failure ? answer.data : answer);

    if (python === undefined) return answer;

    const { copy, structure } = crossing(python);
    const view = pyExport(copy);

    if (object(view)) ANSWERS.set(view, isPlainDict(copy) ? ours('p', namesOf(copy), structure) : structure);
    if (!failure) return view;

    answer.data = view;
    return answer;
};

const actionRelay = (action) => {
    let relay = ACTION_RELAYS.get(action);

    if (relay === undefined) {
        relay = identified(
            (...args) => {
                const answer = action(...args);

                return thenable(answer) ? Promise.resolve(answer).then(answered) : answered(answer);
            },
            action.name,
            action.length
        );
        ACTION_RELAYS.set(action, relay);
    }

    return relay;
};

export const routeActions = (value, where) => {
    const actions = pyExport(value, where);

    if (actions === null || typeof actions !== 'object') return actions;

    return new Proxy(actions, {
        get(target, key) {
            const one = Reflect.get(target, key);

            return typeof one === 'function' ? actionRelay(one) : one;
        }
    });
};

// SvelteKit's remote functions as a `.remote.py` declares them, `query`,
// `command`, `form` and `prerender` (`svelthon.js` hands it these as
// `$app/server`'s): what a Python function answers, the page reads on the
// server too as the browser reads it (`crossing`), each answer of a batched
// query's resolver and each value a live query yields among them. In a remote
// request no page of the server reads it, and nothing is done: the transport
// writes it as pickle writes it. Where pickle will not carry it, the answer
// stays itself, for SvelteKit to refuse; a function of JavaScript's, a
// validator among them, is left as it is.
const ANSWERING = new WeakMap();

const pythonFunction = (one) => typeof one === 'function' && quietPyType(pyBind(one)) !== undefined;

const answering = (fn, remote) => {
    let relays = ANSWERING.get(fn);

    if (relays === undefined) ANSWERING.set(fn, (relays = new Map()));

    let relay = relays.get(remote);

    if (relay === undefined) {
        relay = identified((...args) => (remote?.() ? fn(...args) : crossedAnswer(fn(...args))), fn.name, fn.length);
        relays.set(remote, relay);
    }

    return relay;
};

const crossedAnswer = (answer) => {
    if (thenable(answer)) return Promise.resolve(answer).then(crossedAnswer);
    if (typeof answer === 'function') return answering(answer);
    if (object(answer) && typeof answer[Symbol.asyncIterator] === 'function') return crossedSteps(answer);

    const python = pythonOf(answer);
    const crossed = python === undefined ? undefined : crossing(python, true);

    return crossed === undefined ? answer : pyExport(crossed.copy);
};

const crossedSteps = (source) => {
    const steps = source[Symbol.asyncIterator]();
    const step = (made) => Promise.resolve(made).then((one) => (one.done ? one : Promise.resolve(crossedAnswer(one.value)).then((value) => ({ done: false, value }))));

    return {
        next: (value) => step(steps.next(value)),
        return: (value) => (steps.return ? step(steps.return(value)) : Promise.resolve({ done: true, value })),
        throw: (error) => (steps.throw ? step(steps.throw(error)) : Promise.reject(error)),
        [Symbol.asyncIterator]() {
            return this;
        }
    };
};

// `remote` says whether the request is a remote function's own.
export const remoteHelper = (helper, remote) => {
    if (typeof helper !== 'function') return helper;

    const relay = (...args) => helper(...args.map((one) => (pythonFunction(one) ? answering(one, remote) : one)));

    for (const name of ['batch', 'live']) {
        if (typeof helper[name] === 'function') relay[name] = remoteHelper(helper[name], remote);
    }

    return relay;
};

// What a derived Svelte recomputes raises leaves Python there, as a template
// expression's does: an ordinary `Error` (`pyError`). A derived Python reads,
// an accessor the engine calls, raises again what its body raised (`pyRead`),
// which an `except` takes.
export const pyDerive = (body, where) => () => {
    try {
        return body();
    } catch (error) {
        throw pyError(error, where);
    }
};

export const pyRead = (read) => {
    try {
        return read();
    } catch (error) {
        throw raisedAgain(error);
    }
};

// **A name of the module that nothing has bound yet**, assigned in a branch
// that did not run, or deleted, is read by Python code as CPython reads it,
// `NameError`, and by the template as Svelte renders a value that is not
// there: empty. Bryntime asks the host which reads are the template's
// (`host.absent`).
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
//
// Save a name no statement of the module binds (`unbound`): no name, a typo
// `{conut}` among them, and its read raises `NameError` at its line, as in
// Python and in Svelte.
//
// Per namespace and per file, as the lines are (`fileLines`): the template of
// one variant began where the other's did, and its read raised `NameError`.
const OWN_TEMPLATE = new WeakMap();
const TEMPLATE_LINES = new Map();

export const templateFrom = (file, line, unbound = [], namespace) => {
    const from = { line, unbound: new Set(unbound) };

    TEMPLATE_LINES.set(file, from);
    if (namespace !== undefined) OWN_TEMPLATE.set(namespace, from);
};

host.absent = (file, line, name, namespace) => {
    const from = OWN_TEMPLATE.get(namespace) ?? TEMPLATE_LINES.get(file);

    return rendering > 0 && from !== undefined && line >= from.line && !from.unbound.has(name);
};

// **A directive is a call whose callee is a Python expression.** The markup pass
// writes `use:act.measured={v}` as `use:__brycomp_directiveAction={["act.measured",
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
    if (declared(fn) !== null) return directiveCallable(fn)(...args);

    if (typeof fn !== 'function') {
        throw new TypeError(`svelthon — the directive \`${where}\` names ${String(fn)}, which is not callable`);
    }

    // The adapter `importjs` publishes converts what it is called with, and is
    // handed the arguments as they are; any other JavaScript function, one a
    // prop brought among them, is handed them converted.
    return fn(...(ADAPTERS.has(fn) ? args : forJavaScript(args)));
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
const changed = (before, after, python) => {
    const handed = (value) => {
        if (value === NONE) return undefined;
        const scalar = pyScalar(value);
        return scalar === undefined || (python && !isExactScalar(value)) ? value : scalar;
    };
    const a = handed(before);
    const b = handed(after);

    // What JavaScript makes one number, `1` and `1.0` or `0.0` and `-0.0`, is
    // two values to a Python action, which reads its type and its sign: a
    // scalar is compared with the type it has, the engine's or the
    // primitive's, and by `Object.is`.
    if (python && a === b && ((quietPyType(before) ?? typeof before) !== (quietPyType(after) ?? typeof after) || !Object.is(a, b))) return true;

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
// A Python `update` answers the value, and nothing else it reads: run in
// Svelte's effect, a log it appends to would subscribe that effect to the log,
// and each append would update the action again, a value that is an object
// always counting as changed. A JavaScript one runs as Svelte runs it, in that
// effect: a state it reads is a dependency, whose change updates the action
// again with an object, where untracked the page kept what it had written.
//
// The two are read where Svelte reads them, in the effect that installs the
// action, and not as the action returns, which Svelte untracks: a getter of
// either that reads a state is then a dependency of that effect, which
// installs the action again when it changes, as Svelte's own does. Read early,
// an `update` turned on was never heard of. `update` is asked once, and the
// wrapper is what Svelte calls after.
//
// Svelte's first comparison after the install is against nothing (`prev =
// {}`), so the first run that reads the value again updates the action, the
// value the same or not. Held as installed, that run was skipped when the value
// had not changed, and an action measuring the node missed it.
//
// Which `update` it is, Python's or JavaScript's, is the result's: a Python
// function that installs a JavaScript action and returns what it returned
// hands back JavaScript's, which was handed the Python value, a float its
// `toFixed` refused, where the install had been handed its number.
const actionPayload = (python, result, given) => {
    if (result === null || (typeof result !== 'object' && typeof result !== 'function')) return result;

    let held;
    let first = true;
    let updates;
    const update = ([, , ...next]) => {
        if (!first && !changed(held, next[0], python)) return;

        first = false;
        held = next[0];
        if (python) untrack(() => result.update(held));
        else result.update(forJavaScript([held])[0]);
    };

    return {
        get update() {
            updates ??= given.length > 0 && typeof result.update === 'function';

            return updates ? update : undefined;
        },
        get destroy() {
            const destroy = result.destroy;

            return typeof destroy === 'function' ? () => destroy.call(result) : undefined;
        }
    };
};

// `use:`, called `(node, payload)`. The head is a thunk, read once here, when
// Svelte installs the action: had it been part of the value, a new callee would
// have counted as a new value and called `update`. Svelte calls an action
// optionally, so an absent one installs nothing.
export function directiveAction(node, [where, head, ...value]) {
    const fn = head();

    if (fn === undefined || fn === null || fn === NONE) return undefined;

    const result = directiveCall(where, fn, [node, ...value]);

    return actionPayload(PYTHON_RESULTS.has(result), result, value);
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
              ? pyDict([])
              : {};

    return directiveCall(where, fn, [node, params, options]);
}

// `animate:`, called `(node, { from, to }, payload)`, the payload's place kept
// when the directive gives none, as Svelte keeps it: `undefined` to JavaScript,
// None to Python. An action's is not, and Svelte calls a bare one with the node
// alone.
export function directiveAnimate(node, rects, [where, head, ...value]) {
    return directiveCall(where, head(), [node, rects, value.length ? value[0] : undefined]);
}

// What a directive hands back, read by Svelte: an action's `update` and
// `destroy`, a transition's `duration` and `tick`. A dict holds them as
// entries, an **instance** as methods of its class, which no walk of its own
// properties finds: `return Lease(node, value)` would mount and never update
// nor clean up. Both are read through a view, each name when Svelte asks, as
// Svelte reads its own: an `update` that puts a new `destroy` in the dict it
// returned is heard at teardown, where a copy made at the return called the
// first one and left the resource it had taken since. The view answers
// `undefined` for a name there is none of, which is how Svelte asks whether
// there is one.
//
// A **Python callable** handed back is a deferred transition: Svelte calls it
// later for the config. It is wrapped like the directive's own callee, so its
// arguments are converted and its config comes back through this same rule. A
// callable instance is asked first, before it is taken for a config object.
// And it is read like an instance all the same: an action's result that is a
// function carrying `update` and `destroy`, or an instance with `__call__`,
// still hands Svelte both, which it reads off whatever it is handed. A dict
// with `__call__` is still a dict, whose names are its entries: read as an
// attribute, its `update` was `dict.update`, and its `destroy` none.
//
// A class of the author's is an instance whatever it derives from: `class
// Lease(list)` keeps its `update` and `destroy`, where it was taken for a list
// and copied without them. A dict of any class stays its entries.
//
// Of the functions it holds, those whose answer Svelte does not read are
// called as a cleanup is (`unreadCall`); `css` and `easing` answer Svelte.
const UNREAD_MEMBERS = new Set(['update', 'destroy', 'tick']);

// The results read through that view, whose members are Python's
// (`actionPayload`).
const PYTHON_RESULTS = new WeakSet();

function directiveResult(value, where) {
    const called = declared(value) !== null;
    const instance =
        value !== null &&
        typeof value === 'object' &&
        pyClass(ownType(value)) &&
        !isDict(value) &&
        (authoredClass(ownType(value)) || (!Array.isArray(value) && pyScalar(value) === undefined));

    if (!called && !instance && !isDict(value)) return pyNumbers(value);

    // Read when Svelte asks, after the directive has returned, so what a
    // property raises is relayed here, as under a view (`relayed`). What the
    // function Svelte calls has of its own is its own.
    const view = new Proxy(
        called ? directiveCallable(value) : Object.create(null),
        relayed(
            {
                get(target, key) {
                    if (key in target) return Reflect.get(target, key);
                    if (typeof key === 'symbol') return undefined;

                    const found = isDict(value) ? lookup(value, key) : pyGetattr(value, key, MISSING);

                    if (found === MISSING || found === NONE) return undefined;

                    if (!callable(found)) return pyNumbers(found);

                    return UNREAD_MEMBERS.has(key) ? unreadCall(found) : pyHandler(found);
                }
            },
            `${where} result`
        )
    );

    PYTHON_RESULTS.add(view);
    return view;
}

// Callable in Python, which is the question every boundary that promises to
// adapt a callback asks, and `typeof` cannot answer: `fade = Fades(0.3).run`,
// an object configured once, its method named by the directive, is callable,
// and so are a callable instance and a classmethod. Asked of a callable of
// Python's alone, which both callers have checked (`declared`).
function directiveCallable(member) {
    let wrapped = directives.get(member);

    if (wrapped === undefined) {
        // Trimmed to the arity Python declared, exactly as a handler is: Svelte
        // calls a transition `fn(node, params, options)`, and `def
        // typewriter(node, params)` refuses the third.
        //
        // `declared` reads the receiver, the signature, and
        // leaves `self` out of the arguments, for every shape.
        const found = declared(member);
        const { where } = found;

        // Converted on the way in, like every other call boundary: Svelte hands
        // an action or a transition its JavaScript values, and a fractional one
        // reaching `format(value, '.2f')` must be a float. A DOM node is left
        // alone by `pyArg`, which is what the first argument always is here.
        // Run through `running`, the wrapper of a component's own functions: an
        // `async def` is started, and an error placed.
        wrapped = identified(
            (...args) => running(() => calling(found, args), where, (value) => directiveResult(value, where)),
            nameOf(where),
            arityNow(found.arity)
        );

        directives.set(member, wrapped);
    }

    return wrapped;
}

// `pep.title` inside the markup, on a dict.
//
// A template's expressions already differ from the same text in the script: a
// `{#if}` goes through `__brycomp_truthy` so an empty list is false the Python way, an
// interpolation through `__brycomp_text` so a list renders `['a', 'b']`, an iterable
// through `__brycomp_seq`, a spread through `__brycomp_spread`. The dot joins them: it finds an
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
//
// `otherwise`, when given, is a callable whose result stands for a name that is
// neither, or that holds None, which is `undefined` at every door, as Svelte
// takes a default for `undefined`: the default of a key in a pattern,
// `{#each rows as {id=0}}`. Held as a value, `{"id": None}` showed nothing
// where Svelte's `{id: undefined}` showed `0`.
export function readAttr(target, name, otherwise) {
    // A function a module's namespace exports, `importjs * as callbacks`, is
    // called as JavaScript calls a member (`jsMethod`): on the receiver it is
    // called with, so `onclick={callbacks.receiver}` is handed the element, as
    // Svelte hands it; and on the namespace when it is called with none, so
    // `{actions.who()}` and `use:actions.stamp` read `this` as the script's
    // `actions.who()` does, where the function alone was called on nothing.
    // Read as the engine reads any object's member, it would be bound to the
    // namespace, a handler included. Asked first, a default or none: read as a
    // record's member, `{#each [callbacks] as {receive=None}}` bound the
    // handler to the namespace, where `{receive}` handed it the element. A
    // function is never missing, so a default is still taken as it was.
    //
    // The export read once, what it is asked of the value read: a namespace a
    // proxy stands for answers each read anew, and the read that asked was
    // lost, `14` shown where the export gave `7`. An `undefined` read is
    // answered too, where it went on to read again and showed `7` where the
    // first read gave nothing: its default, as Svelte takes one for
    // `undefined`, or None for a name the namespace has, as the engine reads
    // it. A name it has not goes on, to the error a missing name raises.
    if (moduleNamespace(target)) {
        const member = target[name];

        if (typeof member === 'function') return jsMethod(target, member);
        if (member === undefined && otherwise !== undefined) return invoke(otherwise);
        if (member !== undefined || name in target) return jsMemberValue(target, member);
    }

    // A key with a default, `{value=7}`, which Svelte takes for a member that is
    // missing or `undefined`, read off a JavaScript record, an object or a
    // function no Python type marks: read as JavaScript, once, a getter too, and
    // its member handed over the way the engine hands over any JavaScript
    // member, bound to the record (`jsMember`). Crossed, `undefined` is None, as
    // a `null` given on purpose is, so the default is decided before. A
    // function carrying a member was read as Python reads it, and its `null`
    // took the default.
    if (
        otherwise !== undefined &&
        target !== null &&
        (typeof target === 'object' || typeof target === 'function') &&
        quietPyType(target) === undefined
    ) {
        const member = jsMember(target, name, MISSING);

        return member === MISSING ? invoke(otherwise) : member;
    }

    // With a default, so a miss costs no exception: building one on every field
    // read of every dict would be the whole cost of this feature.
    const found = pyGetattr(target, name, MISSING);
    const value = found !== MISSING ? found : lookup(target, name);

    if (value !== MISSING && !(value === NONE && otherwise !== undefined)) return value;

    // No such key either, or None under a default: the default, or the error a
    // missing attribute raises, built without reading it again. Read again, a
    // `__getattr__` that answered the second time gave a value where the first
    // read found none, and one that never answers was asked twice.
    if (otherwise === undefined) throw pyAttributeError(target, name);

    return invoke(otherwise);
}

// Whether a read through the dot finds the attribute, read once as `readAttr`
// reads it first: the one thing that knows, as a property raising
// `AttributeError` says it holds none and the read takes the key. Told by what
// the class declares, the typed text went to the setter, and the key the field
// read again on its next mount held the old one; told by an earlier read, a
// property that came to hold one since was written past; asked twice, a name
// `__getattr__` answers once was found, then sent to the key. A getter raising
// anything else fails the read, and the write goes to the attribute, as a
// refused read does not stop one.
const readsAttribute = (target, name) => {
    try {
        return pyGetattr(target, name, MISSING) !== MISSING;
    } catch {
        return true;
    }
};

// Whether the dot should write a key rather than an attribute: the object has
// one of that name.
//
// **The probe and the write are two statements.** An exception raised by the
// author's own `__setitem__` is not a reason to write somewhere else, and
// neither is one raised by their `__getitem__` while the key is looked for:
// `lookup` lets both go on. Once the key is found the destination is decided.
const keyed = (target, name) => lookup(target, name) !== MISSING;

// What a write through a dot of the template compiles to: `(obj.attr := value)`,
// which Python's own grammar refuses the walrus, and the write half of
// `bind:value={row.label}`. And `(obj[key] := value)` beside it.
//
// The write half of `readAttr`: an existing key wins over an attribute a read
// does not find, so the write lands where the read comes from. Only an
// *existing* key: what a missing one should do is still open, so it keeps
// Python's own answer. A Python object is asked in the read's order and once:
// the attribute (`readsAttribute`), then the key only for one it does not find;
// asked first, a `__getitem__` refusing a text, rows read by index, failed a
// write the setter takes. One whose class has no `__getitem__` holds no key and
// is read nothing before its setter, as an assignment reads nothing. A
// JavaScript object's attribute and key are one property, which `attributed`
// tells without running a getter.
//
// They return the value, as an assignment expression must, so that a group can
// hold several and `{count}` still reads afterwards.
export function writeAttr(target, name, value) {
    const toKey =
        quietPyType(target) !== undefined
            ? subscriptable(target) && !readsAttribute(target, name) && keyed(target, name)
            : !attributed(target, name) && keyed(target, name);

    if (toKey) {
        // Outside the `try`, for the reason written above `keyed`.
        pySetitem(target, name, value);

        return value;
    }

    pySetattr(target, name, value);

    return value;
}

export function writeItem(target, key, value) {
    pySetitem(target, key, value);

    return value;
}

// The engine's `slice`, which a template `:=` through a slice writes its key
// with (`slices`), under a name of the compiler's: the author's `slice`, a
// function or a number, is no business of a subscript's.
export { pySlice } from 'bryntime';

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
//
// Each value is held as its key (`key`), as a keyed `{#each}` holds a row's: a
// float is an object rebuilt at each read, so `row(0.5)` read once per input
// was two targets and each click took the other choice away; a list or an
// instance is still itself, so two equal rows are still two targets.
const targetOf = (token, where) => ({ token, where: where.map(key) });

// Two inputs write one target when they are of one token and their bindings
// mention the same values, compared the way a Map compares its keys: by
// identity, a NaN equal to itself.
const sameTarget = (a, b) =>
    a.token === b.token &&
    a.where.length === b.where.length &&
    a.where.every((one, i) => one === b.where[i] || (one !== one && b.where[i] !== b.where[i]));

// **One choice of a group is the same value or an equal one**: identity, then
// Python's `==`, as Python's `in` and `list.remove` take an item, and as
// Svelte's own group takes it with a `Set`. `==` because a Brython float is an
// object, so `value={0.5}` evaluated twice is two objects. An `__eq__` that
// raises is not a "no", and its error goes on; a value Python cannot compare at
// all, a foreign JavaScript one, is only itself.
const sameChoice = (one, mine) => {
    try {
        return __brycomp_pybridge.truthy(pyEquals(one, mine));
    } catch (error) {
        if (raised(error)) throw error;

        return one === mine;
    }
};

// **A checkbox group's model holds a value as Python's `in` says**: a selection
// whose class defines `__contains__` answers for itself, as Svelte asks its
// array's `includes`, and a list's own `in` is `sameChoice` along its items.
// None, or no model, holds nothing.
const groupHolds = (model, value) => {
    if (model === undefined || model === null || model === NONE) return false;

    try {
        return __brycomp_pybridge.truthy(pyContains(model, value));
    } catch (error) {
        if (raised(error)) throw error;

        return Array.from(model).some((one) => one === value);
    }
};

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

export function group(node, given) {
    const { current, write, fielded, binding, scope, where = [] } = given;
    const boxes = node.type === 'checkbox';
    const token = groupToken(scope, binding);

    node.$svelthonGroup = targetOf(token, where);

    // The value the markup pass compiled from the tag, and whether the field
    // evaluates it, as any value but static text. `undefined` for a value that
    // is static text, which the node holds and nothing can move. One the field
    // evaluates is read off the field, and never here: a getter, evaluated once
    // more by Svelte's own read of the action's value, which follows what it
    // reads (`deep_read_state`), as Svelte's own group evaluates it a second
    // time to follow it. Read here as well, at the install and at each update,
    // a `value={tickets.next()}` took one ticket more than Svelte's.
    let picked = fielded ? undefined : given.chosen;

    // Read at each use, after Svelte has written the attributes of the turn: a
    // spread's value, its own or an attribute's it overrides, then the value as
    // the field evaluated it (a lone interpolation keeps its type there, as in
    // Svelte), then what the tag compiled to, where the field holds none. A
    // value only itself is equal to was handed over boxed
    // (`choice`), and is taken back as itself.
    //
    // And a control with none of those holds no value: no text the node
    // carries as its attribute, and nothing a spread wrote, which Svelte skips
    // when it is `undefined`, a `None` among them. Svelte's group reads its
    // `__value` then, undefined, which is None; the field's `"on"` is the
    // browser's, no choice of the author's.
    const applied = (written) => CHOSEN.get(written) ?? pyBind(written);

    // The value the field was last handed, read in that cache and kept, from
    // the install on: a `null` there is no value, which `set_value` never
    // writes, keeping a field's `null` as `undefined`, but `set_attribute`'s,
    // which hydration calls to take the default away
    // (`remove_input_defaults`), and the field still holds the value before.
    // Compiled again for the group, `"v-{next_id()}"` answered anew. Whether
    // what was written is a value is what `keep` answers.
    let field = null;
    const keep = (written) => {
        if (written === null) return false;

        field = { value: written };
        return true;
    };
    const cache = fielded ? attributesOf(node) : undefined;

    if (cache !== undefined && 'value' in cache) keep(cache.value);

    const value = () => {
        if ('__value' in node) return applied(node.__value);
        if (cache !== undefined && 'value' in cache) keep(cache.value);
        if (field !== null) return applied(field.value);
        if (picked !== undefined) return pyBind(picked);

        return node.hasAttribute('value') ? node.value : NONE;
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

    // What the author's `__eq__` or `__contains__` raises is told at the binding.
    const located = (read) => {
        try {
            return read();
        } catch (error) {
            throw pyError(error, `bind:group={${binding}}`);
        }
    };

    const alike = (one, mine) => located(() => sameChoice(one, mine));

    // **A value goes into a group's list once.** Two controls may stand for one
    // choice (a form showing the same option in two sections), and `sameChoice`
    // is what says they are one choice, since two Brython values that are equal
    // are rarely the same object.
    const include = (into, held) => {
        if (!into.some((already) => alike(already, held))) into.push(held);
    };

    // The model last shown, which a new value of the field is shown against.
    let model = current;

    const show = (held) => {
        model = held;
        node.checked = located(() => (boxes ? groupHolds(held, value()) : sameChoice(held, value())));
    };

    // Svelte writes a new value of the field in the same turn as the action
    // updates, and after it: the control follows each write, as Svelte's own
    // group follows its control's value. Read at the update, the field still
    // held the value before, and the control kept a state its value no longer
    // had. A write that is no value (`keep`) is no new value to show: shown,
    // hydration's `null` put the server's model back over what the reader
    // picked before the script ran.
    const followed = [];
    const follow = (owner, key, fresh = () => true) => {
        if (owner === undefined || !Object.hasOwn(owner, key)) return;

        let held = owner[key];

        Object.defineProperty(owner, key, {
            configurable: true,
            enumerable: true,
            get: () => held,
            set(next) {
                held = next;
                if (fresh(next)) show(model);
            }
        });
        followed.push([owner, key]);
    };

    follow(node, '__value');
    follow(cache, 'value', keep);

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
        // off. Read here with `sameChoice`, the same object or an equal one,
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
            __brycomp_pybridge.list(node.checked ? picked : picked.filter((one) => !alike(one, mine)))
        );
    };

    // What a reset writes: the empty selection, as Svelte's `bind:group` does,
    // `[]` for checkboxes and, for every group of radios, its `null`, which is
    // `javascript.NULL` in Python as at every door, None being `undefined`. A
    // reset that wrote None also checked again a radio offering None.
    const restored = () => write(boxes ? __brycomp_pybridge.list([]) : null);

    node.addEventListener('change', changed);
    RESETS.set(node, restored);
    watchReset();

    // A control the reader changed before the script ran, which is what a
    // page hydrated after a click looks like: it is no longer at its default.
    // The control wins, and the model is rebuilt from the group once its inputs
    // are all registered and in order, as Svelte's own `bind_group` does;
    // showing the model first would erase the click. A fresh mount makes the two
    // agree, so it shows the model as before. A radio's model is the group's
    // checked input, or none, as Svelte finds it: a radio of another binding
    // picked unchecks this one, and the model kept the choice the page no
    // longer showed.
    //
    // A `checked` the markup writes as an expression is Svelte's, not the
    // reader's: Svelte sets the property and leaves the default to the template,
    // at a fresh mount as at hydration, where it has just overwritten any click.
    // Svelte's own group asks whether it is hydrating; what it wrote, in the
    // cache `value` reads, answers the same question here. The `checked` this
    // pass adds for the server is `undefined` in a browser, which Svelte never
    // writes.
    const written = attributesOf(node);
    const reader = node.defaultChecked !== node.checked && written?.checked === undefined;

    // Unless hydration writes `null` there, taking the attribute away once the
    // page is in place (`remove_input_defaults`): that `undefined` was then a
    // change, written at the next run of the effect, for anything else the
    // page showed, and the radio the server checked went unchecked. Held as
    // `undefined`, it is none, as Svelte's own group writes no `checked`.
    if (written != null && written.checked === undefined) {
        let held;

        Object.defineProperty(written, 'checked', {
            configurable: true,
            enumerable: true,
            get: () => held,
            set(next) {
                held = next ?? undefined;
            }
        });
        followed.push([written, 'checked']);
    }

    if (!reader) show(current);
    else
        queueMicrotask(() => {
            if (boxes) return changed();

            const checked = inOrder().find((one) => one.checked);

            write(checked === undefined ? NONE : checked.$svelthonValue());
        });

    return {
        update(next) {
            node.$svelthonGroup = targetOf(token, next.where ?? []);
            if (!fielded) picked = next.chosen;
            show(next.current);
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
