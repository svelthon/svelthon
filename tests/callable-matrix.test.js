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
import { pyModule } from '../src/lib/runtime.js';
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
    ['an instance whose __call__ is inherited', 'inherited']
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
    ['under its own exported name', (key) => mod[key]],
    ['as a value of an exported mapping', (key) => mod.mapped[key]],
    ['in a configuration a component hands back', (key) => mounted().config(key).hook],
    // What the compiler emits for `use:mod.member` and `in:mod.member`: the
    // directive names a module, and Svelte reads the member off this proxy.
    ['as the member a directive names', (key) => pyModule('callable_matrix')[key]]
];

describe.for(SHAPES)('%s', ([, key]) => {
    test.for(POSITIONS)('crosses as a callback JavaScript can call, %s', ([, reach]) => {
        const got = reach(key);

        expect(typeof got).toBe('function');
        expect(got('event')).toBe(0.25);
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
