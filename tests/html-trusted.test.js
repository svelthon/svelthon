// `{@html}` hands Svelte a `TrustedHTML` an application's policy made as it is,
// which Svelte assigns to `innerHTML` uncoerced. Made text on the way, by the
// conversion an interpolation takes, it was refused where the browser requires
// the policy (`require-trusted-types-for 'script'`), before the first render.
//
// jsdom has no Trusted Types: the policy's object is a class of the test's,
// `trustedTypes.isHTML` tells it, and the `innerHTML` setter records what it is
// handed. The witness is Svelte's own component.
import { test, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import HtmlTrusted from './fixtures/HtmlTrusted.svelte';
import HtmlTrustedNative from './fixtures/HtmlTrustedNative.svelte';

class Trusted {
    constructor(html) {
        this.html = html;
    }

    toString() {
        return this.html;
    }
}

const setter = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');

afterEach(() => {
    delete globalThis.trustedTypes;
    Object.defineProperty(Element.prototype, 'innerHTML', setter);
});

// What each `innerHTML` assignment of the fragment was handed, Svelte's own of
// its templates aside, and what the page shows.
const handed = (Component) => {
    const seen = [];

    globalThis.trustedTypes = { isHTML: (value) => value instanceof Trusted };
    Object.defineProperty(Element.prototype, 'innerHTML', {
        ...setter,
        set(value) {
            if (value instanceof Trusted) seen.push('trusted');
            else if (String(value).includes('<b>ok</b>')) seen.push('text');
            setter.set.call(this, value);
        }
    });

    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { markup: new Trusted('<b>ok</b>') } });

    flushSync();
    const shown = [...target.querySelectorAll('[data-k]')].map((one) => one.innerHTML.replace(/<!---->/g, ''));

    unmount(instance);
    target.remove();
    return { seen, shown };
};

test('{@html} hands a TrustedHTML to Svelte as it is, as Svelte’s own does', () => {
    const python = handed(HtmlTrusted);

    expect(python.seen.length).toBeGreaterThan(0);
    expect(python.seen.every((one) => one === 'trusted')).toBe(true);
    expect(python).toEqual(handed(HtmlTrustedNative));
});
