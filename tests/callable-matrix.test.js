// Shapes against positions, and the same contract asserted in every cell.
//
// *Recognising a callable* produced eight findings in fifteen audit passes, each
// one a site that asked `typeof value === 'function'` where Python's answer is
// wider: a bound method is an object, and so is an instance whose class defines
// `__call__`. Each was repaired where it was found, and the next pass found the
// next site. They are not eight defects; they are eight absent cells of one
// product, and a product is a thing a test can enumerate.
//
// The rows are the ways Python writes a callable, the columns are the boundaries
// that hand one to JavaScript, and the body is the same everywhere: no declared
// parameter, and a float for a result. So one call measures both halves of the
// adaptation — the trim that lets a framework hand an event to a callback that
// never asked for one, and the conversion of what comes back. `toBe` is identity
// on a number, so a Brython float, which is an object holding one, fails it:
// that is the assertion Svelte makes when it computes `t1 + delta * easing(t)`.
//
// **Two holes, found by writing the table and not by reading the code.** An
// instance whose `__call__` is inherited was callable from nowhere at all — the
// lookup read one class dictionary while its comment claimed the chain — and the
// member a *directive* names was still asked with `typeof`, so four rows of that
// column arrived as values Svelte cannot call.
//
// **And two more that the table did not have, found by an outside reading of it.**
// The columns were the crossings their author knew about, which is the way a
// matrix goes wrong: a missing column is invisible in a green one. `pyExport`
// has three branches — a value, a mapping, a list — and only two were here. Then,
// once the list was green, the same item found that the rule held at the *top* of
// every container and went no further under a mapping. Both are columns now, and
// the lesson is the one clause: read the branches of the code, do not trust your
// own list of them.
//
// **How to use it.** A new boundary adds a column; if it cannot be added, that is
// the signal it invented a recognition of its own. A new finding fills a cell
// rather than getting a test of its own, and its neighbours say at once whether
// it is a cell or a whole line. A cell that cannot be filled is written below as
// a limit, where everyone can see it.
//
// **The one column that cannot exist**: a DOM handler. `pyEvent` fires what it is
// given through `schedule` and drops the result, by contract — nobody is there to
// read what a click returns — so the second half of the assertion has no meaning
// there. `tests/bound-methods.test.js` and `tests/handler-arity.test.js` hold
// that boundary's own contract.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { directiveAction } from '../src/lib/runtime.js';
import * as mod from './fixtures/callable_matrix.py';
import { taken } from './fixtures/matrix_library.js';
import CallableMatrix from './fixtures/CallableMatrix.svelte';

// Six spellings, four recognitions: a lambda, a decorated function and a closure
// are the first row again, and an object built to hold a function is the fifth.
const SHAPES = [
    ['a function', 'fn'],
    ['a bound method', 'bound'],
    ['a classmethod', 'classbound'],
    ['a staticmethod', 'staticfn'],
    ['a callable instance', 'instance'],
    ['an instance whose __call__ is inherited', 'inherited'],
    // The class dictionary holds the descriptor Brython builds for a
    // `@staticmethod`, not a function, and the signature is read off the second
    // one: the instance crossed as an object that JavaScript could not call,
    // while Python called it perfectly well.
    ['an instance whose __call__ is a staticmethod', 'fixed'],
    // The same under `@classmethod`, whose receiver is the class.
    ['an instance whose __call__ is a classmethod', 'classcall'],
    // A `__call__` that is itself bound elsewhere, whose signature is its
    // function's but the receiver it holds: read as the class held it, it had
    // none, and the event a caller hands over reached a method declaring no
    // parameter.
    ['an instance whose __call__ is a bound method', 'delegated'],
    ['an instance whose __call__ is a method of a class', 'delegated_class'],
    // And a builtin bound to its value, which the engine handed the instance
    // as well, a receiver it already had.
    ['an instance whose __call__ is a bound builtin', 'delegated_native'],
    // And a callable instance, whose own class says what it takes, followed
    // as far as the chain goes: read where it was held, it had no signature.
    ['an instance whose __call__ is a callable instance', 'delegated_instance'],
    ['an instance whose __call__ is one, two levels down', 'delegated_twice']
];

const mounted = () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(CallableMatrix, { target });

    flushSync();

    return instance;
};

const POSITIONS = [
    [
        'as an argument of a JavaScript call',
        (key) => {
            mod.as_argument(key);

            return taken();
        }
    ],
    [
        'nested in an options object',
        (key) => {
            mod.as_option(key);

            return taken().hook;
        }
    ],
    [
        'nested in a list argument',
        (key) => {
            mod.as_listed(key);

            return taken()[0];
        }
    ],
    ['under its own exported name', (key) => mod[key]],
    ['as a value of an exported mapping', (key) => mod.mapped[key]],
    // The column §3.40 of the outside reading found empty, a day after the rest
    // of this table was written: the export adapted the values of a mapping and
    // handed a list to the plain walk, so one Python object was a function under
    // one key and an object with fields under an index. The list kept the data
    // and lost the call, the mapping kept the call and lost the data, and
    // neither said anything.
    ['as an element of an exported list', (key) => mod.listed[mod.order.indexOf(key)]],
    ['as an element of an exported tuple', (key) => mod.tupled[mod.order.indexOf(key)]],
    // The four cells the same item named at the next reading, once the row above
    // was green: the rule held at the top of every container and stopped one
    // level below a dict, because the walk under it was called without the rule
    // at all. It reads like depth and it is not — a list inside a list always
    // worked, since a list carries the rule to its children.
    ['in a list a mapping holds', (key) => mod.nested.handlers[mod.order.indexOf(key)]],
    ['in a mapping a mapping holds', (key) => mod.nested.inner[key]],
    ['two containers down from a mapping', (key) => mod.nested.deep[0][mod.order.indexOf(key)]],
    ['in a configuration a component hands back', (key) => mounted().config(key).hook],
    ['returned whole by a component', (key) => mounted().returned(key)],
    // The route an export does not take: what an exported function *returns*.
    // It crossed with no callback rule at all, so the same value was adapted
    // when published and raw when handed back — a bound method arrived as an
    // object, and a function kept Python's contract, raising on the argument a
    // consumer gives it.
    ['returned by an exported function', (key) => mod.made(key)],
    ['returned inside a mapping', (key) => mod.made_inside(key).hook]
];

describe.for(SHAPES)('%s', ([, key]) => {
    test.for(POSITIONS)('crosses as a callback JavaScript can call, %s', ([, reach]) => {
        const got = reach(key);

        expect(typeof got).toBe('function');
        expect(got('event')).toBe(0.25);
    });
});

// What a directive names is not handed to Svelte: Svelte calls the runtime's
// adapter with the Python value, and the adapter calls it. Every shape is called
// the same way from there.
describe.for(SHAPES)('%s', ([, key]) => {
    test('is called by the directive that names it', () => {
        const value = globalThis.__BRYTHON__.imported.callable_matrix[key];

        expect(directiveAction('event', [key, () => value])).toBe(0.25);
    });
});

// What a wrapper does not carry, said once instead of discovered one container
// at a time. A callable instance crosses as a function and its fields stay in
// Python, where the call still reaches them — which is what the row above
// proves, since its answer is computed from its own field. The defect §3.40
// named was never a missing field; it was that one container kept the field and
// the other kept the call, for one Python object.
describe('a callable instance', () => {
    test.for([
        ['under its own exported name', () => mod.instance],
        ['as a value of an exported mapping', () => mod.mapped.instance],
        ['as an element of an exported list', () => mod.listed[mod.order.indexOf('instance')]]
    ])('crosses as its call and not as its fields, %s', ([, reach]) => {
        expect(typeof reach()).toBe('function');
        expect(reach().factor).toBeUndefined();
    });
});

// And what a JavaScript caller reads of it: a log, a stack, a library that
// dispatches on `fn.name`, and this project's own refusals.
//
// One Python `def` answered `plain` at the top level of a module — where the
// compiler emits `const plain = …` and JavaScript names the function after the
// binding — and `""` from inside a list, from inside a mapping, and from every
// wrapper this file builds, since a function expression returned from a function
// is nameless. Same function, different routes, different names.
//
// Read off `$function_infos` and not off `fn.name`: Brython names the function
// it compiles after a counter, so the obvious source answers `f6084…`.
// One Python callable is one JavaScript function, at every crossing and between
// crossings.
//
// The rule that adapts a callable used to be written twice: once for the
// arguments, where it is `pyHandler` and caches per callable, and once for the
// exports, where it wove the *site's* label into the wrapper — so a label, which
// is per site, decided identity. Two reads of a factory gave two functions for
// one Python value, and one value held twice in a list came back as two.
//
// The data beside it never lost that: two references to one list cross as one
// array. What the two shapes share now is the same cache.
describe.for([
    ['a function', 'fn'],
    ['a bound method', 'bound'],
    ['a callable instance', 'instance']
])('%s returned by an exported function', ([, key]) => {
    test('is one JavaScript function, whoever asks twice', () => {
        const first = mod.made(key);
        const second = mod.made(key);

        expect(first).toBe(second);

        const registry = new Set([first]);

        expect(registry.delete(second)).toBe(true);
    });

    test('and one function twice inside a single result', () => {
        const [a, b] = mod.made_twice(key);

        expect(a).toBe(b);
        expect(a()).toBe(0.25);
    });

    test('and one function from a component, whoever asks twice', () => {
        const component = mounted();

        expect(component.returned(key)).toBe(component.returned(key));
    });

    test('and the same once an async export resolves', async () => {
        const component = mounted();
        const later = await component.returned_later(key);

        expect(later).toBe(component.returned(key));
        expect(later('event')).toBe(0.25);
    });
});

// And a function JavaScript built, handed back by a component, keeps its own
// contract: it is not wrapped, and what it is called with is not converted.
test('a JavaScript function a component returns is returned as it is', () => {
    const own = (value) => value.toFixed(2);

    expect(mounted().returned_native(own)).toBe(own);
});

// The control: the same sharing in data, which held throughout and is what the
// callbacks are measured against.
test('two references to one list come back as one array', () => {
    const [a, b] = mod.shared_rows();

    expect(a).toBe(b);
});

describe('the name a JavaScript caller reads', () => {
    test.for(POSITIONS)('is the one Python recorded, %s', ([, reach]) => {
        expect(reach('fn').name).toBe('fn');
    });
});

// An instance is called through Python's own protocol, so a `__call__` replaced
// on the class after the crossing is the body that runs. Its *signature* was read
// once, at the crossing, and the wrapper went on cutting the arguments to the old
// one: the new body was handed one argument fewer than it declares, and the same
// call from Python worked. One object, two contracts.
//
// The witness is the export itself, taken before the replacement and used after:
// a registry holding a callback keeps the function it was given, so the repair
// may not hand out a new one.
describe('an instance whose __call__ is replaced after it crossed', () => {
    test('runs the new body with the new signature', () => {
        const kept = mod.changing;

        expect(kept()).toBe(0.25);

        mod.replace_call();

        expect(mod.call_from_python(0.125)).toBe(0.25);
        expect(kept(0.125)).toBe(0.25);
        expect(mod.changing).toBe(kept);
    });
});

// A static `__call__` declares no receiver, so there is no `self` to take out of
// its signature. Trimming one anyway is the defect that trades for the one above:
// the instance would be callable and its only argument would be eaten.
describe('a static __call__ that takes an argument', () => {
    test.for([
        ['published on its own', () => mod.doubling],
        ['as a value of an exported mapping', () => mod.doublers.inner]
    ])('receives it, %s', ([, reach]) => {
        expect(reach()(0.125)).toBe(0.25);
    });
});

// A `__call__` whose type has `__get__` is bound, and what `__get__` hands back is
// what is called: the instance's own `__call__`, declaring nothing, is never
// reached, and the argument is not trimmed away from the function that takes it.
test('a __call__ bound by its __get__ receives what the call hands it', () => {
    expect(mod.bound_by_getter(0.125)).toBe(0.25);
});

// And the trim is to what `__get__` hands back: a function that takes nothing,
// handed back by a descriptor or a `property`, is handed no event, as it is
// when it crosses directly. The descriptor was read for a signature it does not
// carry, everything was passed, and the click raised `TypeError`. Resolved once
// per call.
test('a __call__ bound by its __get__ is trimmed to what it hands back', () => {
    const before = mod.resolutions();

    expect([mod.getter_nothing('event'), mod.property_nothing('event')]).toEqual([0.25, 0.25]);
    expect(mod.resolutions() - before).toBe(1);
});

// Resolved at the call and only then: publishing one, as this module does,
// asks its `property` nothing, which raised here before it was prepared and
// took the whole module's import down with it.
test('a __call__ bound by its __get__ is not resolved before it is called', () => {
    expect(mod.lazy_resolutions()).toBe(0);

    mod.prepare();
    expect(mod.not_yet('event')).toBe(0.25);
    expect(mod.lazy_resolutions()).toBe(1);
});

// What the class holds is asked at each call: a descriptor its class replaced
// with an ordinary callable instance is called as that, trimmed to it, and
// never asked for a `__get__` it does not have, which raised `AttributeError`.
test('a __call__ descriptor is called as what the class holds now', () => {
    const kept = mod.strategy;

    expect(kept('event')).toBe(0.25);
    mod.make_ordinary();
    expect(kept('event')).toBe(0.5);
});

// And a descriptor handing back another is adapted at each level, where the
// event reached the function the second one handed back.
test('a __call__ descriptor handing back another is adapted at each level', () => {
    expect(mod.outer('event')).toBe(0.25);
});

// And one reached through an instance a class stores as its `__call__`: Python
// follows the instance and binds its descriptor to it. The adaptation took the
// outer object for what to call, adapted it again, and recursed until the stack
// was spent.
test('a __call__ that is an instance with a descriptor __call__ is followed to it', () => {
    expect(mod.assigned('event')).toBe(0.25);
});

// And the other way round from an ordinary `__call__` to a descriptor: the
// callback kept from before resolves it at the call, where it handed the event
// to the function the `property` hands back.
test('a __call__ the class later makes a descriptor is called through it', () => {
    const kept = mod.turning;

    expect(kept('event')).toBe(0.25);
    mod.make_property();
    expect(kept('event')).toBe(0.25);
});

// And one that is a builtin, `staticmethod(abs)`, which has no signature to read
// and is called through Python's own protocol: what it answers is what CPython
// answers, `round(-0.5)` the int 0 and not a negative zero.
describe('a static __call__ that is a builtin', () => {
    test.for([
        ['published on its own', () => [mod.absolute, mod.rounding]],
        ['as a value of an exported mapping', () => [mod.builtin_held.abs, mod.builtin_held.round]]
    ])('is a function, %s', ([, reach]) => {
        const [absolute, rounding] = reach();

        expect(typeof absolute).toBe('function');
        expect(absolute(-0.5)).toBe(0.5);
        expect(Object.is(rounding(-0.5), 0)).toBe(true);
    });
});

// A class `__call__` declares the class as its receiver, which is taken out, and
// nothing else.
test('a classmethod __call__ that takes an argument receives it', () => {
    expect(mod.class_doubling(0.125)).toBe(0.25);
    expect(mod.doublers.by_class(0.125)).toBe(0.25);
});

// And the name belongs to the callable, not to where it was written.
//
// The label the export carries is the *position* — `holder — src/m.py`, which is
// what a diagnostic should name — and it stood in as the function's name when
// nothing else answered. So `{"inner": handler}` reported `holder`: a name taken
// from wherever the walk began, on a value that had one of its own. A log read
// the name of a dict the author never asked about.
describe('a callable whose class writes `name` and `length`', () => {
    // The author's own word, when they wrote one. A JavaScript function carries a
    // `name` whether or not anyone chose it, so the question is *which* word goes
    // there, not whether the field crosses: `on_save` says more in a log than the
    // qualname of the method that runs it, and an outside reading asked for it in
    // those terms. Read off the instance's own storage, so no property of the
    // author's runs because something was named.
    test.for([
        ['published on its own', () => mod.labelled],
        ['published inside a mapping', () => mod.holder.inner],
        ['published inside a list', () => mod.stacked[0]]
    ])('takes the name its author gave it, %s', ([, reach]) => {
        expect(reach().name).toBe('mine');
    });

    // And the class's qualname when the author named nothing, which is every
    // other callable instance in this file.
    test('or the name of the call it is, when there is no other', () => {
        expect(mod.instance.name).toBe('Strategy.__call__');
    });

    // The limit, and it is the one the fields above already state: a callable
    // crosses as its call. What is particular to these two is that they are not
    // *empty* on the other side — every JavaScript function owns them — so they
    // answer for the call instead of for the author. Two languages disagreeing
    // about what a function carries is not a thing to repair here; Python still
    // has both, which is the line that says so.
    test('while the author keeps both, in Python', () => {
        expect(mod.reads_its_own()).toEqual(['mine', 3]);
    });

    // `length` is the other word, and the one a library reads to learn what a
    // callback takes. Every wrapper answered 0, because a function with a rest
    // parameter declares nothing and that is what all of them are.
    //
    // It was measured and reverted once: a module's own functions were wrapped by
    // the compiler, in a string, so only some routes could have carried it and
    // `three` would have answered 0 at the top level and 3 from inside a list —
    // the asymmetry the name had just been repaired for. Every wrapper is built
    // in one file now, so the objection went with the duplicate.
    test.for([
        ['three declared parameters', 0, 3],
        ['a *args, which declares none', 1, 0]
    ])('reports %s', ([, at, length]) => {
        expect(mod.arities[at].length).toBe(length);
        expect(mod.three.length).toBe(3);
    });

    // An instance reads its `__call__` at every call, so its wrapper trims to
    // nothing and would report 0. What a library reads is what the call takes.
    test('and a callable instance reports what its call takes', () => {
        expect(mod.doubling.length).toBe(1);
        expect(mod.instance.length).toBe(0);
    });
});

// A neighbour decides for nobody: the callback is adapted and the number beside
// it stays a number. It is the half that kept working while the callback did
// not, which is what made the failure quiet enough to survive fifteen passes.
describe('the data beside the callback', () => {
    test.for([
        [
            'in an argument',
            () => {
                mod.as_option('bound');

                return taken();
            }
        ],
        ['in a configuration', () => mounted().config('bound')]
    ])('crosses as itself, %s', ([, reach]) => {
        expect(reach().duration).toBe(0.5);
    });
});
