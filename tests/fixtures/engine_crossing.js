// A library reached six ways from Python: by name, through a namespace, a
// default export, a nested member, and constructed with `.new`, by name and
// through the namespace. Each answer is text, so one assertion reads them all.
export const inspect = (kind, a, b) => {
    if (kind === 'alias') return a === b ? 'same' : 'different';
    if (kind === 'nested-alias') return a.left === a.right ? 'same' : 'different';
    if (kind === 'list-cycle') return a[0] === a ? 'cycle' : 'broken';
    if (kind === 'dict-cycle') return a.self === a ? 'cycle' : 'broken';
    if (kind === 'keys') return Object.keys(a).sort().join('|');
    if (kind === 'rows') return a.rows.join('|');
    if (kind === 'call') return String(a('an argument the callback does not take'));
    if (kind === 'types') return [typeof a, typeof b].join(',');
    if (kind === 'none') return [a === undefined ? 'undefined' : String(a), b[0] === null ? 'null' : String(b[0])].join(',');
    return 'unknown';
};

export class Inspector {
    constructor(kind, a, b) {
        this.answer = inspect(kind, a, b);
    }
}

export const back = (a) => a;

export const nested = { inspect, back };

export default { inspect, back };

export function service(mode) {
    const api = { run() {} };
    if (mode === 'frozen') return Object.freeze(api);
    if (mode === 'sealed') return Object.seal(api);
    if (mode === 'nonextensible') return Object.preventExtensions(api);
    return api;
}

export const registry = () => ({ held: new Set() });
export const add = (box, fn) => box.held.add(fn).size;
export const remove = (box, fn) => (box.held.delete(fn), box.held.size);
