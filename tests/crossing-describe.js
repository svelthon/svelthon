// How the crossing matrices write a JavaScript value out: a Python one by its
// type, a view by its contents, anything else by its constructor. Brython is
// loaded before this module is.
import { ownType } from '../src/lib/runtime.js';

export const describeJs = (value, seen = new Set()) => {
    const $B = globalThis.__BRYTHON__;

    if (value === undefined) return 'undefined';
    if (value === null) return 'null';

    const type = typeof value;

    if (type === 'number' || type === 'boolean') return String(value);
    if (type === 'bigint') return `${value}n`;
    if (type === 'string') return JSON.stringify(value);
    if (seen.has(value)) return 'cycle';
    seen.add(value);

    if (ownType(value) !== undefined || $B.is_dict(value)) return `python ${$B.class_name(value)}`;
    if (type === 'function') return value.$infos || value.$function_infos ? 'python function' : 'function';

    const prototype = Object.getPrototypeOf(value);
    const entries = (keys) => keys.map((key) => `${String(key)}: ${describeJs(value[key], seen)}`).join(', ');

    if (Array.isArray(value)) {
        return `${prototype === Array.prototype ? '' : 'view '}[${[...value].map((one) => describeJs(one, seen)).join(', ')}]`;
    }
    if (prototype === Object.prototype || prototype === null) return `{${entries(Reflect.ownKeys(value))}}`;
    // A dict's or an instance's view carries `Object.prototype`'s own names.
    if (Object.getPrototypeOf(prototype) === Object.prototype && Object.hasOwn(prototype, 'hasOwnProperty')) {
        return `view {${entries(Object.keys(value))}}`;
    }

    return prototype?.constructor?.name ?? 'object';
};
