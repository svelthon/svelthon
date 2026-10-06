// The witness of `def_exports.py`: the same rebindings, written in JavaScript.
export let action = () => 7;
export let data = 42;

export function scalar() {
    action = 42;
}

export function function_() {
    action = () => 9;
}

export function remove() {
    action = undefined;
}

export function restore() {
    action = () => 7;
}

export function callable_data() {
    data = () => 7;
}
