// What every compiled component imports. Order is load-bearing: globals, then
// the runtime, then boot.
import './globals.js';
import '../../vendor/brython.js';
import './boot.js';

// Python's None, so a prop the parent never passed reads as None rather than
// leaking JavaScript's undefined into Python.
export const NONE = globalThis.__BRYTHON__.builtins.None;

// Svelte interpolates with String(), and None is an object — it would render as
// "[object Object]". Non-enumerable so nothing that walks the singleton's
// properties can see it. (The same gap remains for lists and dicts, which
// render with JavaScript's stringification rather than Python's str().)
Object.defineProperty(NONE, 'toString', {
    value: () => 'None',
    enumerable: false,
    configurable: true
});

const _b_ = globalThis.__BRYTHON__.builtins;

// Inside a Svelte template you are in JavaScript, not Python — and the two
// disagree. `py` is the bridge, injected into every component that uses
// `<script lang="python">`.
export const py = {
    // JS calls every object truthy, so `{#if items}` would be true for an empty
    // list, an empty dict, or None. Conditions are rewritten to go through this.
    truthy(value) {
        if (value === undefined || value === null) return false;
        // str/int/float/bool are JS primitives in Brython, and there the two
        // languages already agree.
        if (typeof value !== 'object' && typeof value !== 'function') return Boolean(value);
        try {
            return _b_.bool.$factory(value) === true;
        } catch {
            return Boolean(value);
        }
    },

    // Python's str(), for interpolation: `['a', 'b']` rather than `a,b`.
    str(value) {
        if (value === undefined || value === null) return '';
        try {
            return _b_.str.$factory(value);
        } catch {
            return String(value);
        }
    },

    repr(value) {
        try {
            return _b_.repr(value);
        } catch {
            return String(value);
        }
    }
};

// Expose one component-level signal as a property of the namespace Brython
// writes into. Values pass through untouched — never wrapped, never proxied —
// which is the point: a Svelte state proxy around a Brython object breaks its
// type machinery (`repr((1, 2))` fails with "requires a 'tuple' object but
// received a 'tuple'"). Reactivity comes from rebinding the signal, not from
// observing the value.
//
// Accessors go on the *prototype*, never on the namespace itself. Rebinding a
// global emits `$B.delete_for_reassign(name, locals)` ahead of the assignment,
// and a plain `delete locals.count` would drop an own accessor for good —
// silently unhooking the signal after the very first write, which is why
// `count = count + 1` stopped propagating while `count += 1` still worked.
// `delete` ignores inherited properties; assignment still runs the inherited
// setter.
export function bind(proto, key, get, set) {
    Object.defineProperty(proto, key, {
        get,
        set,
        enumerable: true,
        configurable: true
    });
}
