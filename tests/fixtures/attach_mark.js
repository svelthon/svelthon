// An attachment written in JavaScript, which a Python markup attaches as it is.
export function mark(node) {
    node.setAttribute('data-marked', 'js');
}
