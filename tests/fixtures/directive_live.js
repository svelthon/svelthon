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

const show = (node, options) => {
    node.textContent = `${options.nested.amount.toFixed(2)}/${options.values[0].toFixed(2)}`;
};

export function native_options(node, options) {
    show(node, options);

    // A bare function of the action's own, which Svelte calls with the value.
    return { update: (next) => show(node, next) };
}
