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
