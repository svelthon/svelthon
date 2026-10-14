// A JavaScript `Set` and `Map` a Python component holds, of this window or of
// another, whose `Set` and `Map` are its own.
export const jsSet = (...members) => new Set(members);
export const jsMap = (...pairs) => new Map(pairs);

const frame = () => document.body.appendChild(document.createElement('iframe')).contentWindow;

export const frameSet = (...members) => new (frame().Set)(members);
export const frameMap = (...pairs) => new (frame().Map)(pairs);

// A map of one entry, and its key, whose key or value Python holds as
// something of its own: a float, an int past 2⁵³, JavaScript's null, an object.
// `kind` reads `js map same key float` or `js map new value null`.
const object = { id: 1 };
const FORMS = { float: 1.5, big: 2n ** 60n, null: null, object };

export const crossing = (kind, Kind = Map) => {
    const [, side, form] = /^js map (?:same|new) (key|value) (\w+)$/.exec(kind) ?? [null, 'value', 'float'];
    const one = FORMS[form];

    return side === 'key' ? [new Kind([[one, 1]]), one] : [new Kind([['x', one]]), 'x'];
};
