// A library reached as a namespace, a default export and a nested object, whose
// functions take callbacks and read `this`.
export const invoke = (fn) => fn('unused library argument');

export let current = () => 'first';
export const swap = () => {
    current = () => 'second';
};

export const helpers = {
    prefix: 'n:',
    label(value) {
        return this.prefix + value;
    },
    nested: { twice: (fn) => fn(1) + fn(2) }
};

export class Counter {
    constructor() {
        this.count = 0;
    }

    add(fn) {
        this.count += fn('ignored');
        return this.count;
    }
}

// A constructor that calls the callback it is given, with an argument more.
export class Watcher {
    constructor(fn) {
        this.answer = fn('library argument');
    }
}

// An API reached after a promise resolves.
const api = { invoke: (fn) => fn('library argument') };
export const later = () => Promise.resolve(api);

// A getter that consumes what it reads: a second read loses a value.
export const queue = () => {
    const rows = ['A', 'B', 'C'];
    return {
        get next() {
            return rows.shift();
        }
    };
};

// A callback written as a property, a function held in an array, a callback
// nested in an options object.
export const target = () => ({
    fire() {
        return this.handler('event');
    }
});
export const handlers = [(fn) => fn('library argument')];
export const withOptions = (options) => options.cb('library argument');

// A registry, reached directly and as a member.
const held = new Set();
export const register = (fn) => {
    held.add(fn);
    return held.size;
};

export default { invoke, helpers, register };
