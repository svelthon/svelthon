// A library whose functions read their receiver, as methods do.
export const label = 'actions';

export function who() {
    return this?.label ?? 'no receiver';
}

export function stamp(node, value) {
    node.dataset.stamp = `${this?.label ?? 'no receiver'}:${value}`;
}

export function clicked() {
    this.dataset.receiver = this.tagName;
}
