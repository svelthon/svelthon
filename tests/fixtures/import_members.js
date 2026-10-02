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

export default { invoke, helpers };
