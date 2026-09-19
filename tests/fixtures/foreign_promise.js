// A JavaScript helper that answers with something awaitable resolving a value
// **Python owns**.
//
// The Python dict is built here, with Brython's own constructor, and that is the
// whole point of the fixture. Handing one *in* from Python does not work: an
// argument crossing into a `__js__` helper is converted on the way, so the
// promise would already hold a plain object and every row would pass whatever
// the boundary did. Measured, after writing it the other way round first.
const payload = () => {
    const $B = globalThis.__BRYTHON__;
    const dict = $B.builtins.dict.$factory();

    $B.$setitem(dict, 'answer', 42);
    $B.$setitem(dict, 'rows', $B.builtins.list.$factory([1, 2]));

    return dict;
};

const elsewhere = () => {
    const frame = document.body.appendChild(document.createElement('iframe'));

    return frame.contentWindow.Promise;
};

export const foreign = () => elsewhere().resolve(payload());
export const local = () => Promise.resolve(payload());

// A bare thenable, which `await` accepts and no constructor claims. Its `then`
// answers `undefined`, the way the three-line shape everyone writes does, so it
// is also the case that says a boundary must normalise rather than chain.
export const custom = () => ({ then: (resolve) => resolve(payload()) });

// The other half of a promise, from that same other context.
export const rejecting = () => elsewhere().reject(new Error('gone'));
