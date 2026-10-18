// The calls between the two languages: a Python function JavaScript calls, a
// JavaScript function Python calls, their arguments and their answers, and the
// coroutines run on Brython's loop. Moved out of the runtime as it was; the
// host reaches it through `bryntime.js`.
import * as core from './core.js';
import * as mutations from './mutations.js';
import { pyError, thrown } from './errors.js';
import { takesNoPositional, viewOf } from './views.js';

const { LIST_VIEW, NONE, PLAIN_VIEW, VIEWED, VIEW_OF, _b_, authoredInstance, boundMethod, bytesIn, bytesOut, callDescriptor, callable, declares, define, entering, isSet, javascriptOwn, lent, ownAttributes, plainData, propertyKey, propertyName, pyAwaitable, pyBind, pyBytes, pyClass, pyCoroutine, pyEntries, pyItems, pyScalar, pyType, quietPyType, quietly, refused, slotDeclared, twoKeys, unpackedPair, wrapperMethod } = core;
const { MISSING, PUBLISHED, follow, entered } = mutations;

// A promise that can tell it is being waited for.
//
// `await p` on a plain promise never reads `p.then`: the language recognises
// its own kind and goes to the internal machinery instead. A subclass is not
// that kind, so `await` takes the long way and calls `then` like anyone else,
// which is how `schedule` below knows the failure reached somebody. Everything
// that asks stays satisfied: it is still an instance of Promise.
class Waited extends Promise {}


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

// A value JavaScript hands Python as an argument. An object is the host's to
// know first (`lent.argument`): one it recognises, a framework's own, may reach
// Python as something else; any other crosses as itself.
export function pyArg(value) {
    // `undefined` is `None` and `null` is `javascript.NULL`, the rule `pyData`
    // applies.
    if (value === undefined) return NONE;
    if (value === null) return null;
    if (typeof value !== 'object') return pyBind(value);

    return lent.argument(value);
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
export const nameOf = (where) => where.split(' — ')[0].replace(/\(\)$/, '');

// A call of what `declared` found, with what a caller hands it: trimmed to what
// the signature declares, converted, and passed.
//
// The trim is the boundary's contract (it is what lets a framework hand an
// event to a callback that never asked for one), and `pyArg` is the conversion
// every call boundary owes, written here once for every wrapper below.
//
// **Trimmed first, then converted, and only what is passed.** An argument the
// callable does not take is never read: converting it means asking whether it is
// a route event, which reads its fields and copies its `params`, and a payload
// the callback discards must not be able to fail the call or be observed by it.
//
// **And resolved before either.** An instance whose `__call__` is a descriptor
// learns what it calls, and so what it takes, only when its `__get__` answers,
// once per call: `resolve` asks it, and the trim reads the answer. Converted
// against the instance's own `Infinity` and trimmed afterwards, an argument the
// callback discards had already been read.
//
// `arity` is a number, or a function answering it at the call: a callable
// instance trims against whatever its class holds now, so its arity is a
// question asked each time, not a number fixed once.
export const arityNow = (arity) => (typeof arity === 'function' ? arity() : arity);

export const calling = (found, args, convert = pyArg) => {
    const { fn, arity } = found.resolve?.() ?? found;

    return fn(...args.slice(0, arityNow(arity)).map(convert));
};

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
export const identified = (wrapper, name, arity) =>
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

export function pyCall(found, named, convert = pyArg) {
    const { fn, where, arity } = found;

    const wrapper = (...args) => {
        try {
            const result = scheduleAsync(calling(found, args, convert), where);

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
export function declared(value) {
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
    if (call !== null && boundByGet(call)) return instanceCall(value, `${globalThis.__BRYTHON__.class_name(value)}()`, call);

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

// A class's `__call__` that is neither a function nor a method but an object
// whose type has `__get__`: a `property`, or a descriptor of the author's. What
// Python calls is what that `__get__` hands back for the instance.
const boundByGet = (call) => {
    const $B = globalThis.__BRYTHON__;

    return (
        typeof call !== 'function' &&
        !boundMethod(call) &&
        call.sm_callable === undefined &&
        call.cm_callable === undefined &&
        $B.search_slot($B.get_class(call), 'tp_descr_get', $B.NULL) !== $B.NULL
    );
};

// What a descriptor in an instance's call hands back, or null when there is
// none: the class's `__call__`, followed through the instances a class stores
// as its `__call__`, as Python follows them, and a descriptor found there bound
// to the instance that holds it, by its `__get__`.
function boundCall(value) {
    const $B = globalThis.__BRYTHON__;
    const seen = new Set();
    let owner = value;
    let call = callDescriptor(owner);

    while (call !== null && callableInstance(call) && !seen.has(call)) {
        seen.add(call);
        owner = call;
        call = callDescriptor(owner);
    }

    return call !== null && boundByGet(call) ? $B.$call($B.$getattr(call, '__get__'), owner, pyType(owner)) : null;
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
//
// A `__call__` that is a descriptor, a `property` or one of the author's, at
// whatever depth and whenever the class made it one: what its `__get__` hands
// back is asked at the call, and only then, so making the wrapper or handing it
// over runs no getter that may not be ready to answer. What it takes is unknown
// until then, so `resolve` answers, at the call, the adaptation of what it
// calls, which trims as the same callable handed over directly does: a
// `property` handing back a function that takes nothing was handed the click,
// and raised. `calling` asks it before converting anything.
function instanceCall(value, where, origin) {
    const $B = globalThis.__BRYTHON__;

    const resolve = () => {
        const bound = boundCall(value);

        if (bound === null) return { fn: (...args) => $B.$call(value, ...args), arity: liveArity(value) };

        const inner = declared(bound);

        if (inner === null) return { fn: (...args) => $B.$call(bound, ...args), arity: Infinity };

        return inner.resolve?.() ?? inner;
    };

    return {
        fn: (...args) => calling({ resolve }, args, (one) => one),
        resolve,
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
// wrapper this site builds has the same contract (`pyCall(found)`, its name,
// label and arity all read from `fn` itself), so one per function is the whole
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
    const wrapped = pyCall(found, found.named ?? undefined, (one) => pyArg(inbound(one)));

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
// `None` is `undefined`, the engine's pairing, as an argument, so a parameter
// with a default takes it whichever way the function was imported, and inside
// a container alike.
export const outbound = (value, made) => {
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
//
// Except a function Python handed out (`PUBLISHED`), which comes back as the
// callable it stands for: a library that keeps a callback and hands it back,
// `identity(callback)`, gives the very callback, the one a set holds. It came
// back as an adapter around its own wrapper, still callable and no longer it.
const inbound = (value) =>
    typeof value === 'function' ? functionIn(value) : (bytesIn(value) ?? globalThis.__BRYTHON__.jsobj2pyobj(value));

// A function entering Python by a door that may be JavaScript's, whichever door:
// what Python published is its own callable again, so a Python reader holds
// what a Python writer held; a JavaScript function is the adapter an import of
// it gets (`jsCall`), which converts what Python hands it and what it answers;
// a Python one is itself. A callback a JavaScript parent hands as a prop, or as
// an argument to a component's or a store's function, received the float
// Brython builds where it expected a number.
export function functionIn(value) {
    return PUBLISHED.get(value) ?? (declared(value) === null ? adapter(value) : value);
}

// The keywords of a call, which the engine hands over as a trailing object
// carrying them under its own symbol, `$B.KW`, or null for a call that has
// none: no argument an author passes, a Python dict or a JavaScript object, can
// carry that key.
export const keywordsOf = (args) => args[args.length - 1]?.[globalThis.__BRYTHON__.KW] ?? null;

// The engine's own reading of them, which is what a Python function gets: the
// explicit ones, then each `**` mapping through its `keys()` and
// `__getitem__`, a key given twice refused, as an object of the keywords by
// name, for the function called `name`.
export const parseKeywords = (keywords, name) => globalThis.__BRYTHON__.parse_kwargs(keywords, name);

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
    const keywords = keywordsOf(args);

    if (keywords === null) return args;

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
export const ADAPTERS = new WeakMap();

// Whether a value is one of `set`, or stands for one, however it reached Python
// and came back: the adapter an import from JavaScript made of it (`ADAPTERS`),
// the function published for a value of Python's (`PUBLISHED`), and the method
// the engine wraps when Python reads it off a JavaScript object, which keeps
// the function under `$js_func`.
export const standsFor = (value, set) => {
    const seen = new Set();

    while (value !== null && (typeof value === 'function' || typeof value === 'object') && !seen.has(value)) {
        if (set.has(value)) return true;

        seen.add(value);
        value = ADAPTERS.get(value) ?? PUBLISHED.get(value) ?? quietly(value, '$js_func');
    }

    return false;
};

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

// What an import from JavaScript binds, and what a namespace of one hands
// Python: a function enters as a function enters by any door (`functionIn`),
// so a Python function a JavaScript module re-exports is that function again,
// where it was adapted as JavaScript's and its `1.0` crossed as the number 1,
// back an int, and a `Price(float)` as a plain float.
export function jsCall(value) {
    // An imported constant crosses here too, and it crosses once, as the same
    // value returned by an imported *function* crosses through `inbound`:
    // `export const half = 0.5` is a float, which `format(half, ".2f")` takes.
    // A namespace, a default export or an object crosses as it is: the
    // functions reached through it are the engine's to call, and the engine
    // hands Python callables over through `pyobj2jsobj_hook`, above `pyHandler`.
    return typeof value === 'function' ? functionIn(value) : pyBind(value);
}

// The adapter of a JavaScript function, one for the life of the function.
function adapter(value) {
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
export const STALE = new Set();

export const flushExports = () => {
    if (STALE.size === 0) return;

    const due = [...STALE];

    STALE.clear();
    for (const one of due) one();
};

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
export const running = (call, where, convert = pyNumbers) => {
    try {
        const result = entered(call);
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

// What the crossing borrows of these calls, which it cannot import back.
lent.functionIn = functionIn;
lent.handler = pyHandler;
lent.schedule = scheduleAsync;
