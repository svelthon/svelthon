// A library that keeps what it is handed, as a chart keeps its data.
const kept = {};

export function keep(name, value) {
    kept[name] = value;
}

export function kept_value(name) {
    return kept[name];
}

export function push_to(name, item) {
    kept[name].push(item);
}

export const same = (a, b) => a === b;
