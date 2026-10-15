// How many keys were enumerated on one object from `start` on: its test reads
// the count, and `stop` gives `Reflect.ownKeys` back.
const ownKeys = Reflect.ownKeys;
let target;
let keys = 0;

export function watch(view) {
    target = globalThis.__BRYTHON__.PYOBJ_MAP.get(view) ?? view;
}

export function start() {
    keys = 0;
    Reflect.ownKeys = (one) => {
        const found = ownKeys(one);
        if (one === target) keys += found.length;
        return found;
    };
}

export function stop() {
    Reflect.ownKeys = ownKeys;
    return keys;
}
