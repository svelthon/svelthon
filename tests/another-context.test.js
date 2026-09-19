// A value is what it is, whichever JavaScript context built it.
//
// Four passes in a row found the same mistake at four different sites, each time
// as if it were a new subject: `url instanceof URL` refused a URL from an
// iframe, `value instanceof Date` refused a Date from one at three sites of
// `helpers.js`, `result instanceof Promise` skipped the conversion of what a
// foreign promise resolved to, and `prototype === Object.prototype` read a
// foreign object as opaque — so `to_py` gave back something without `.get`, an
// export kept a Brython dict raw inside it, and `urlencode` wrote the engine's
// spelling of an object into a query string.
//
// Every one of them is one sentence: **an intrinsic is per-realm, and identity
// against a local one is not a type test.** A worker, a `vm` context, an iframe,
// a browser extension and several SvelteKit adapters all produce these values,
// and none of them is exotic.
//
// So this file is the family rather than the four subjects. Each row is a type,
// each column a question the project asks of a JavaScript value, and the
// assertion is always the same: **the foreign twin answers what the local one
// answers**, whatever that answer is — a refusal included, since half of these
// failed by raising and half by saying nothing.
//
// A fifth realm-sensitive site adds a row here. The ones already closed keep
// their tests in the files about their own subject; what this holds is the
// question they have in common, which is the thing no one of them could see.
import { test, expect, describe } from 'vitest';
import { seen } from './fixtures/another_context.py';

describe.for([
    // The four intrinsics the boundary has been caught on, and the one it must
    // keep refusing.
    ['object', 'a bag of keys, which has to become a dict'],
    ['date', 'a Date, which the two date helpers and urlencode read'],
    ['url', 'a URL, which the route boundary recognises'],
    // The control: a Map is a class instance in any realm, and the repair must
    // not start flattening one. Both sides refuse it the same way.
    ['map', 'a Map, which is a value of a class and stays one'],
    // And the shape that says *rootless* is not the whole answer: a
    // `class Thing extends null {}` prototype has no prototype either, exactly
    // like every realm's `Object.prototype`. Both sides of this row are built
    // here; what it measures is class-against-bag, which no realm changes.
    ['rootless', 'a class declared `extends null`, which is still a class']
])('%s: %s', ([kind]) => {
    test('answers the same as the twin built here', () => {
        expect(seen(kind, true)).toEqual(seen(kind, false));
    });
});

// And the local answers are real ones, not four matching failures — the shape a
// grid of equalities cannot see on its own.
describe('and what those answers actually are', () => {
    test('an object is a dict, encodable and serialisable', () => {
        expect(seen('object', false)).toEqual(['dict', '42', 'answer=42', '{"answer":42}']);
    });

    test('a Date encodes as the sortable spelling', () => {
        expect(seen('date', false)[2]).toBe(encodeURIComponent('1970-01-01T00:00:00.000Z'));
    });

    test('and an instance of a rootless class keeps its class', () => {
        // Flattened, it would read as a dict of its fields with the method gone.
        expect(seen('rootless', false)[0]).not.toBe('dict');
    });

    test('and a Map is not flattened into one', () => {
        const [type, answer] = seen('map', false);

        // Still a JavaScript object to Python, and `.get` still reaches the
        // Map's own method rather than a dict's: it kept its class, which is
        // what the repair had to leave alone.
        expect(type).toBe('IterableJavascriptObject');
        expect(answer).toBe('42');
    });
});
