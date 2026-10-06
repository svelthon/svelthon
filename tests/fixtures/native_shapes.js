// The JavaScript half of the crossing matrix: one class whose instances carry a
// callback **as a field**, which is an ordinary shape and the one that used to
// decide the fate of the whole object, and one that carries none.
export class Service {
    constructor() {
        // A field, not a method: `Object.entries` finds it, a prototype method
        // is not found there, and that difference is what the export branch
        // used to read as *this is a mapping of functions*.
        this.callback = () => 42;
    }

    ping() {
        return 'ok';
    }
}

export class Plain {
    ping() {
        return 'ok';
    }
}

export const service = new Service();
export const plain = new Plain();

// A literal of functions, JavaScript's and crossing as itself, beside the
// Python mapping of functions the module adapts.
export const actions = { save: () => 'saved' };

// A binding that changes, read through the module scope rather than through an
// import list.
export let amount = 1;

export function advance() {
    amount += 1;
}

export function actual() {
    return amount;
}

// Identity, asked from JavaScript about what Python handed back.
export const same = (a, b) => a === b;
