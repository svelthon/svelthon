// Values built by **another JavaScript context**, beside their local twins.
//
// An iframe is the cheapest realm there is under jsdom; a worker, a `vm`
// context, a SvelteKit adapter and a browser extension are the ones a real
// application meets. What they all change is the same single thing: every
// intrinsic — `Object`, `Date`, `URL`, `Promise` — is a different object, so
// `instanceof` and any comparison against a local prototype answer false for a
// value that is the genuine article in every other respect.
const elsewhere = () => document.body.appendChild(document.createElement('iframe')).contentWindow;

export const foreignObject = () => {
    const made = new (elsewhere().Object)();

    made.answer = 42;

    return made;
};

export const localObject = () => ({ answer: 42 });

export const foreignDate = () => new (elsewhere().Date)(0);
export const localDate = () => new Date(0);

export const foreignURL = () => new (elsewhere().URL)('https://example.test/a?page=7');
export const localURL = () => new URL('https://example.test/a?page=7');

// The negative control, and the one that says the repair is a *root* prototype
// rather than "anything foreign": a Map is a class instance in any realm, and
// flattening one would destroy it.
export const foreignMap = () => new (elsewhere().Map)([['answer', 42]]);
export const localMap = () => new Map([['answer', 42]]);

// The other negative control, and the one that says *rootless* is not the whole
// answer: `class Thing extends null {}` is valid JavaScript whose prototype has
// no prototype, exactly like every realm's `Object.prototype`. It is still a
// class, and flattening an instance into its fields loses the method.
//
// Not built in an iframe: what this row measures is class-against-bag, which no
// realm changes, and jsdom does not run scripts inside one.
class Rootless extends null {
    label() {
        return 'method';
    }
}

// Built with `Object.create` rather than `new`: a constructor that extends null
// has no `super()` to call, so the class exists for its prototype and its
// method. Both sides of the row are the same shape — the row is not a realm
// pair, it is the one that says a rootless prototype can still be a class.
export const rootlessInstance = () => {
    const made = Object.create(Rootless.prototype);

    made.answer = 42;

    return made;
};

export const rootlessTwin = () => rootlessInstance();
