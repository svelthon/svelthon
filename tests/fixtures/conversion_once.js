// A key whose conversion for a JavaScript call, once armed, is counted and
// refused the first time, and the collections a Python component hands it to.
let record;

export function makeKey() {
    record = { armed: false, reads: 0 };

    const own = record;

    return (record.key = new Proxy({}, {
        get(target, name, receiver) {
            if (typeof name === 'symbol' && name.description === 'JSOBJ' && own.armed) {
                own.reads += 1;
                if (own.reads === 1) throw new Error('conversion refused');
            }

            return Reflect.get(target, name, receiver);
        }
    }));
}

export function makeCollection(kind, key) {
    record.kind = kind;
    record.held =
        kind === 'set add' ? new Set() : kind === 'set delete' ? new Set([key]) : kind === 'map key' ? new Map() : kind === 'map delete' ? new Map([[key, 1]]) : new Map([['x', 'old']]);

    return record.held;
}

export function arm() {
    record.armed = true;
    record.reads = 0;
}

export function inspect() {
    const { held, key, kind, reads } = record;

    return { size: held.size, holds: kind === 'map value' ? held.get('x') === key : held.has(key), reads };
}
