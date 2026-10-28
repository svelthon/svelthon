// What every compiled component imports. Bryntime comes first, through its one
// door, the package: it starts the engine, and installs the mutation tracking
// on it, before this module runs.
import * as core from 'bryntime';
import { untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import BROWSER from 'esm-env/browser';
import { attributeWrapper } from './attributes.js';

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
    thrown,
    relayed,
    raised,
    schedule,
    scheduleAsync,
    pyArg,
    pyNumbers,
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
    restOf,
    unpackStarred
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
    unpackedPair,
    pyIterable,
    jsonCopy,
    plainData
};

export { refusal, pyTypeName, keywordsOf, parseKeywords, pyJsonParse } from 'bryntime';

// The name this project's author knows, which signs every refusal the crossing
// makes, as every other refusal here is signed.
host.name = 'svelthon';

// How Svelte's reactions read and write, which Bryntime follows a watched
// Python value through. Whether the code running is a reaction is Svelte's
// `$effect.tracking()`, and whether a write would be refused is a write Svelte
// checks and that changes nothing, which raises where Svelte refuses one, in a
// derived or a block. A plain module has no runes, so both are handed over by
// the first component or store that loads, whose script Svelte compiles
// (`__pybridge.tracking`, `__pybridge.refusing`), and the runtime asks nothing
// of Svelte's internals. Until one has, every read is taken for a reaction's,
// which costs a walk and subscribes nothing outside one, so a page of
// JavaScript components reading a `.py` module's objects is followed all the
// same; and nothing is refused.
host.subscriber = createSubscriber;
host.untrack = untrack;

// What Bryntime borrows of this module: the rows a Python iterable yields as
// JavaScript walks them, by the template's own walk; SvelteKit's request event,
// handed to Python as the snapshot `routeArgument` takes; and the line of its
// file a frame's line stands for, by the offset that file registered.
lent.seq = (value) => __pybridge.seq(value);
lent.argument = (value) => routeArgument(value);
lent.place = (file, line) => inFile(line, FILE_LINES.get(file) ?? 0);

// Whether the tag a `<svelte:element>` renders makes a custom element, as
// Svelte tells one there, by the element's name: a dash in it.
const customTag = (tag) => typeof tag === 'string' && tag.includes('-');

// The doors this module opens, each with its rule, registered under its name
// (`doors`) and held by the entry of `__pybridge` that opens it. Held, not
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

// A spread to a JavaScript child: each value crosses as a prop written by name
// does, `attribute` and then the floats of a config made numbers (`pyNumbers`).
const spread = (value) => spreadOf(value, (one) => pyNumbers(attribute(one)));

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

// The template helpers, re-exported so a generated component has one specifier
// to import rather than two, and so every satellite repo keeps the single
// `svelthon/bridge` alias it already resolves.
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

// Inside a Svelte template you are in JavaScript, not Python, and the two
// disagree. This is the bridge behind `__truthy`, `__text`, `__seq` and
// `__spread`, the four names a compiled template expression actually calls.
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
// arguments crossed (`__pybridge.snippet`).
const CROSSING_SNIPPETS = new WeakMap();

// Each snippet a Python markup declared, as it announced itself
// (`__pybridge.pythonSnippet`), and the calls in progress on a server that
// hand one values: what it was handed, before crossing.
const PYTHON_SNIPPETS = new WeakSet();
const SERVED_ARGUMENTS = [];
let CROSSING_PAIR = null;

// The `<select>` elements of each instance a spread may make multiple, by their
// place in the markup (`__pybridge.selectShape`), and the one each binding's
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
// namespace has bound (`__pybridge.declaration`).
const RUNE_MARKED = new WeakMap();
const RUNE_MARKERS = [];
const BOUND = new WeakMap();

export const __pybridge = {
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

    // A class the script declares, read: a reaction follows the special
    // methods its metaclass gives it, when the metaclass is the author's
    // (`followMetaclass`), and nothing else of it.
    declared(value) {
        followMetaclass?.(value);

        return value;
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
        // Handed through a `{@render}` argument, which is Python, it comes
        // back as the adapter made for it, which knows the component.
        const python = pythonComponent(component);
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

        if (isDict(value)) {
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
        // read the same way. Read by index into a plain array (`byIndex`).
        if (Array.isArray(value) || isSet(value)) {
            return byIndex(iterated(value))
                .filter((one) => __pybridge.truthy(one))
                .map((one) => __pybridge.klass(one));
        }

        return __pybridge.truthy(value) ? __pybridge.str(value) : undefined;
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
            return pyStr(value);
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
        return (value) => (Array.isArray(value) && !optionValue(scope, place, value) ? __pybridge.selected(value) : pyBind(value));
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

    // The value of a `use:`, read as Svelte reads an action's value in the
    // effect that hands it to `update` (`readState`), and handed back as it
    // is. It reaches Svelte inside the directive's array, which Svelte does
    // not read into, so a change inside a state handed to the action never
    // called `update`.
    watched(value) {
        readState(value);
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
    // component's `__collection` carries the result to the block with Svelte's
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

        // A pair made anew holding the same row stands for it while its key
        // does too: a key read off the pair itself, `id(pair)`, is a new one,
        // and the block takes the new pairs, as Svelte's does. Asked of every
        // pair made anew, since one key may read the pair for one row and its
        // members for another, `pair[0] if pair[0] == 0 else id(pair)`: against
        // the key noted for the one it stands for when nothing under it changed
        // since, and otherwise against the key of that one, read again. One key
        // read per pair made anew, as Svelte reads every key when its iterable
        // runs again. Unfollowed.
        //
        // And every row of an iterable made anew, `rows = list(rows)`: a key
        // may read what nothing follows, a JavaScript object's field, and the
        // block kept the key noted where Svelte's reads it again.
        const renewed = (rows, anew) => {
            for (let at = 0; at < held.length; at++) {
                if ((held[at] === rows[at] && !anew) || !(at in keys)) continue;

                const was = seenUnder(held[at]) === moved[at] ? keys[at] : untrack(() => keyOf(held[at], at));

                if (untrack(() => keyOf(rows[at], at)) !== was) return true;
            }

            return false;
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

                // A foreign iterable is walked as Svelte walks one.
                if (!Array.isArray(rows)) {
                    held = rows;
                    return true;
                }

                const marker = MARKS.get(rows);
                let unchanged =
                    walked && ((rows === source && marker !== undefined && marker.stamp === stamp) || sameRows(held, rows));
                const anew = rows !== source;

                source = rows;
                stamp = marker?.stamp;

                if (unchanged && keyOf !== undefined && renewed(rows, anew)) unchanged = false;
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

        return value === null ? null : __pybridge.truthy(value);
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
        const fn = __pybridge.bound(value);

        if (typeof fn !== 'function' || owns.includes(fn)) return fn;

        let crossing = CROSSING_SNIPPETS.get(fn);

        if (crossing === undefined && standsFor(fn, PYTHON_SNIPPETS)) return fn;

        if (crossing === undefined) {
            const crossed = (one) => pyNumbers(__pybridge.bound(one));

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
    // when nothing was handed, as Svelte reads one on `undefined`.
    param(value, served, at, fallback) {
        const given = served !== null && at < served.length ? served[at] : value;

        return given === undefined && fallback !== undefined ? fallback() : pyBind(given);
    },

    // The row a snippet's positional pattern takes apart, as Svelte's own
    // `to_array` takes one: an array as it is, so that an element is read where
    // it is read and a change made in place is seen, and another iterable as
    // its first `length` elements, which is as far as the pattern reads.
    positional(value, length) {
        if (Array.isArray(value)) return value;
        if (!(Symbol.iterator in value)) return Array.from(value);

        const row = [];

        for (const one of value) {
            row.push(one);
            if (row.length === length) break;
        }

        return row;
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
        const out = __pybridge.toContext(value);

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
    spreadElement(value, event = (one) => pyEvent(one), grouped = false, custom = false) {
        if (value === null || value === undefined || value === NONE) return spreadOf(value);

        const read = spreadOf(value, (one) => one);
        const out = spread(read);

        for (const key of Object.keys(out)) {
            const wrapper = attributeWrapper(key);
            if (key[0] + key[1] === 'on') out[key] = event(read[key]);
            else if (wrapper === '__class') out[key] = __pybridge.klass(read[key]);
            else if (wrapper === '__truthy' && !custom) out[key] = __pybridge.truthy(read[key]);
            else if (wrapper === '__hidden' && !custom) out[key] = __pybridge.hidden(read[key]);
            else if (key === 'value') out[key] = (grouped ? COMPARED.choice : COMPARED.scalar)(__pybridge.bound(read[key]));
        }

        return out;
    },

    // An attribute of the boolean table on a `<svelte:element>` whose tag is
    // known only as it renders, `tag`: on a custom element, which Svelte tells
    // by its name (`element.nodeName.includes('-')`), a property's, set to the
    // value as it is, and on any other element its Python truth, `hidden` with
    // its third state (`wrapper`). `value` is the Python value.
    element(tag, wrapper, value) {
        if (customTag(tag)) return __pybridge.bound(value);

        return wrapper === '__hidden' ? __pybridge.hidden(value) : __pybridge.truthy(value);
    },

    // And a spread there, the same question asked of each key it gives.
    elementSpread(tag, value, event, grouped = false) {
        return __pybridge.spreadElement(value, event, grouped, customTag(tag));
    }
};

// The doors `__pybridge` and the boundaries below open, under their names
// (`doors`): each entry is its door's rule, and holds it. A child's door takes
// the component after the value; a constant defined further down is read at
// the call.
doors.out('spread-element', __pybridge.spreadElement);
doors.out('child', (value, component, kind) => __pybridge.child(component, value, kind));
doors.out('each', __pybridge.seq);
doors.out('debug', __pybridge.debugged);
doors.out('context', __pybridge.toContext);
doors.out('action', __pybridge.watched);
doors.out('class', __pybridge.klass);
doors.out('key', __pybridge.key);
doors.out('truth', __pybridge.truthy);
doors.out('hidden', __pybridge.hidden);
doors.out('text', __pybridge.str);
doors.out('snippet', __pybridge.snippet);
doors.out('export', pyExport);
doors.out('handler', pyEvent);
doors.out('attach', pyAttach);
doors.out('expression', pyNumbers);
doors.out('expression-python', (value) => keptPython(value));
doors.out('expression-child', (value) => handedPython(value));
doors.out('expression-scalar', (value) => COMPARED.scalar(value));
doors.out('expression-selection', (value) => COMPARED.selection(value));
doors.in('context', __pybridge.received);
doors.in('snippet-param', __pybridge.param);
doors.in('selected', __pybridge.selected);
doors.in('list', __pybridge.list);
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
            if (Object.prototype.propertyIsEnumerable.call(value, key)) define(out, key, convert(value[key]));
        }

        return out;
    }

    for (const [key, one] of starredEntries(value)) define(out, propertyName(key, out), convert(one));

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
export const marks = (value) => MARKS.get(value);

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

// What an object JavaScript hands Python as an argument is to Python
// (`lent.argument`): SvelteKit's request event, as a snapshot of real dicts;
// anything else, as itself.
const routeArgument = (value) => {
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
};

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

    const { where } = found;

    // The line of an error is placed by the file its frame is in (`fileLines`),
    // which is not always the component setting the handler: `onclick={store.boom}`
    // runs a `.py`'s function.
    return (...args) => {
        try {
            return schedule(calling(found, args), where);
        } catch (error) {
            throw thrown(pyError(error, where));
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

    if (found === null) return __pybridge.bound(value);

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
                throw thrown(pyError(error, where));
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
export function laterRoot() {
    let destroy;
    let stopped = false;

    return {
        stop() {
            if (destroy === undefined) stopped = true;
            else destroy();
        },
        start(make) {
            if (!stopped) destroy = make();
        }
    };
}

export function pyTeardown(value, where) {
    if (pyAwaitable(value)) {
        schedule(value, where);
        return undefined;
    }

    const cleanup = pyHandler(value);
    return typeof cleanup === 'function' ? cleanup : undefined;
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
            const found = declared(value) ?? { fn: value, arity: Infinity };

            return running(() => calling(found, args), where, exported ? published : returned);
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
                kept === true ? keptPython : kept === 'child' ? handedPython : (COMPARED[kept] ?? pyNumbers)
            ),
        nameOf(where),
        arity
    );

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
const TEMPLATE_LINES = new Map();

export const templateFrom = (file, line) => {
    TEMPLATE_LINES.set(file, line);
};

host.absent = (file, line) => {
    const from = TEMPLATE_LINES.get(file);

    return rendering > 0 && from !== undefined && line >= from;
};

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
              ? pyDict([])
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
// still hands Svelte both, which it reads off whatever it is handed. A dict
// with `__call__` is still a dict, whose names are its entries: read as an
// attribute, its `update` was `dict.update`, and its `destroy` none.
//
// A class of the author's is an instance whatever it derives from: `class
// Lease(list)` keeps its `update` and `destroy`, where it was taken for a list
// and copied without them. A dict of any class stays its entries.
function directiveResult(value, where) {
    const called = declared(value) !== null;
    const instance =
        value !== null &&
        typeof value === 'object' &&
        pyClass(ownType(value)) &&
        !isDict(value) &&
        (authoredClass(ownType(value)) || (!Array.isArray(value) && pyScalar(value) === undefined));

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

                    const found = isDict(value) ? lookup(value, key) : pyGetattr(value, key, MISSING);

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
        const target = found ?? { fn: member, arity: Infinity };
        const where = found === null ? `${path}()` : found.where;

        // Converted on the way in, like every other call boundary: Svelte hands
        // an action or a transition its JavaScript values, and a fractional one
        // reaching `format(value, '.2f')` must be a float. A DOM node is left
        // alone by `pyArg`, which is what the first argument always is here.
        // Run through `running`, the wrapper of a component's own functions: an
        // `async def` is started, and an error placed.
        wrapped = identified(
            (...args) => running(() => calling(target, args), where, (value) => directiveResult(value, where)),
            nameOf(where),
            arityNow(target.arity)
        );

        directives.set(member, wrapped);
    }

    return wrapped;
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
//
// `otherwise`, when given, is a callable whose result stands for a name that is
// neither: the default of a key in a pattern, `{#each rows as {id=0}}`.
export function readAttr(target, name, otherwise) {
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

    // A function a module's namespace exports, `importjs * as callbacks`, is
    // called as JavaScript calls a member (`jsMethod`): on the receiver it is
    // called with, so `onclick={callbacks.receiver}` is handed the element, as
    // Svelte hands it; and on the namespace when it is called with none, so
    // `{actions.who()}` and `use:actions.stamp` read `this` as the script's
    // `actions.who()` does, where the function alone was called on nothing.
    // Read as the engine reads any object's member, it would be bound to the
    // namespace, a handler included.
    if (moduleNamespace(target) && typeof target[name] === 'function') return jsMethod(target, target[name]);

    // With a default, so a miss costs no exception: building one on every field
    // read of every dict would be the whole cost of this feature.
    const found = pyGetattr(target, name, MISSING);
    if (found !== MISSING) return found;

    const item = lookup(target, name);
    if (item !== MISSING) return item;

    // No such key either: the default, or the real lookup, which raises.
    return otherwise === undefined ? pyGetattr(target, name) : invoke(otherwise);
}

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
// The write half of `readAttr`: an existing key wins over an attribute, so the
// write lands where the read came from. Only an *existing* key: what a missing
// one should do is still open, so it keeps Python's own answer.
//
// They return the value, as an assignment expression must, so that a group can
// hold several and `{count}` still reads afterwards.
export function writeAttr(target, name, value) {
    if (!attributed(target, name) && keyed(target, name)) {
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
const targetOf = (token, where) => ({ token, where });

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
        return __pybridge.truthy(pyEquals(one, mine));
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
        return __pybridge.truthy(pyContains(model, value));
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

export function group(node, [current, write, chosen, fielded, binding, scope, where = []]) {
    const boxes = node.type === 'checkbox';
    const token = groupToken(scope, binding);

    node.$svelthonGroup = targetOf(token, where);

    // The value the markup pass compiled from the tag, and whether the field
    // evaluates it, as any value but static text. It is also what makes the
    // action update when the value changes, as Svelte's own group reads its
    // value with the model. `undefined` for a value that is static text, which
    // the node holds and nothing can move.
    let picked = chosen;

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

    const value = () => {
        if ('__value' in node) return applied(node.__value);

        const written = fielded ? attributesOf(node) : undefined;

        if (written !== undefined && 'value' in written) return applied(written.value);
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

    if (!reader) show(current);
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

