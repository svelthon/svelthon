// An action exported as a binding the module replaces, and one that reads its
// options as JavaScript does, at any depth.
export let mark;

export function reset() {
    mark = (node) => {
        node.textContent = 'first';
    };
}

export function replace() {
    mark = (node) => {
        node.textContent = 'second';
    };
}

reset();

// A transition that destructures its parameters with a default, as Svelte's own
// do: it needs an object, never null.
export function defaults(node, { amount = 0.5 } = {}) {
    node.textContent = amount.toFixed(2);
    return { duration: 0 };
}

// An action handing back an instance whose methods read `this`.
class Lease {
    constructor(node, value) {
        this.node = node;
        this.update(value);
    }

    update(value) {
        this.node.textContent = value.toFixed(2);
    }

    destroy() {
        this.node.dataset.cleanup = 'done';
    }
}

export const leased = (node, value) => new Lease(node, value);

// Two actions counting the updates they are given, written on the node.
const counting = (name) => (node) => {
    node.dataset.action = name;
    node.dataset.updates = '0';

    return {
        update() {
            node.dataset.updates = String(Number(node.dataset.updates) + 1);
        }
    };
};

export const first = counting('first');
export const second = counting('second');

const show = (node, options) => {
    node.textContent = `${options.nested.amount.toFixed(2)}/${options.values[0].toFixed(2)}`;
};

export function native_options(node, options) {
    show(node, options);

    // A bare function of the action's own, which Svelte calls with the value.
    return { update: (next) => show(node, next) };
}
