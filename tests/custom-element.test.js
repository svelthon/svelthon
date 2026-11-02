import { test, expect, describe, afterEach } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { compile } from '../src/lib/compile.js';
import './fixtures/Stepper.svelte';
import WordHost from './fixtures/WordHost.svelte';
import StarHost from './fixtures/StarHost.svelte';
import './fixtures/ModuleInspectElement.svelte';
import './fixtures/TypedElement.svelte';
import './fixtures/ObjectFormElement.svelte';
import './fixtures/PartialPropsElement.svelte';
import './fixtures/PartialPropsElementNative.svelte';
import './fixtures/ReflectElement.svelte';
import './fixtures/ReflectElementNative.svelte';
import './fixtures/EntityNamedElement.svelte';
import './fixtures/FlagElement.svelte';
import './fixtures/FlagElementNative.svelte';
import './fixtures/PrototypeTypedElement.svelte';
import './fixtures/UndefinedPropElement.svelte';
import './fixtures/UndefinedPropElementNative.svelte';

// **An entry of `customElement.props` that writes no type keeps the type the
// annotation names**, as Svelte infers one from a default of `$props()`:
// `{ reflect: true }`, `{ attribute: … }` or `{}` on a `bool` lost it, and an
// attribute present but empty arrived as the empty string, which Python reads
// false. A type the entry writes is the author's.
test('a flag whose entry configures something else than its type is a flag, as Svelte’s is', async () => {
    const read = async (tag) => {
        const element = document.createElement(tag);

        for (const name of ['reflected', 'active', 'empty', 'both-on', 'spelled']) element.setAttribute(name, '');
        document.body.appendChild(element);
        flushSync();
        await Promise.resolve();
        flushSync();

        try {
            return [
                ...['reflected', 'renamed', 'empty', 'both', 'spelled'].map((name) => [name, element[name]]),
                element.querySelector('p').textContent
            ];
        } finally {
            element.remove();
        }
    };
    const native = await read('flag-element-native');

    expect(native).toEqual([
        ['reflected', true],
        ['renamed', true],
        ['empty', true],
        ['both', true],
        ['spelled', ''],
        'on|on|on|on|off'
    ]);
    expect(await read('flag-element')).toEqual(native);
});

// **An annotation names a type of the table only by the table's own names**:
// one spelled like a property of `Object.prototype`, `constructor` or
// `toString`, read what the prototype holds there and wrote `type: undefined`
// into the element's options, which Svelte refuses. The import above is that
// element compiled; its attributes are strings, as an unknown type leaves them.
test('a prop annotated with a class spelled like a property of Object.prototype keeps no type', async () => {
    const element = document.createElement('prototype-typed');

    element.setAttribute('first', 'a');
    element.setAttribute('second', 'b');
    document.body.appendChild(element);
    flushSync();
    await Promise.resolve();
    flushSync();

    try {
        expect(element.shadowRoot.querySelector('p').textContent).toBe('a|b');
    } finally {
        element.remove();
    }
});

// A prop declared `reflect` is written back to its attribute, as Svelte writes
// it: its default, a value the page sets, an attribute the page writes, and a
// value the component computes itself, a float made JavaScript's number.
// The tag is the attribute as Svelte reads it, character references decoded.
test('an element named with a character reference registers under the decoded name', () => {
    expect(customElements.get('entity-a')).toBeDefined();
});

test('a reflected prop follows its value onto the attribute, as Svelte does', async () => {
    const settle = async () => {
        flushSync();
        await Promise.resolve();
        flushSync();
    };

    const read = async (tag) => {
        const element = document.createElement(tag);
        const seen = [];

        document.body.appendChild(element);
        await settle();

        try {
            seen.push(element.getAttribute('level'));
            element.level = 7;
            await settle();
            seen.push(element.getAttribute('level'));
            element.setAttribute('level', '9');
            await settle();
            seen.push(element.getAttribute('level'));
            element.querySelector('[data-k="step"]').click();
            await settle();
            seen.push(element.getAttribute('level'), String(element.level));

            return seen;
        } finally {
            element.remove();
        }
    };

    expect(await read('reflect-element')).toEqual(await read('reflect-element-native'));
    expect(await read('reflect-element-native')).toEqual(['1', '7', '9', '9.5', '9.5']);
});

// A plain prop the page sets `undefined` reads its default, before the element
// is connected and before it is connected again: destructured as a bindable,
// which the author never wrote, it was refused by Svelte's rule for a bound
// `undefined` (`props_invalid_value`), and the element stayed empty.
test('a plain prop the page sets undefined reads its default, as Svelte’s does', async () => {
    const settle = async () => {
        flushSync();
        await Promise.resolve();
        flushSync();
    };

    const text = (element) => element.shadowRoot?.querySelector('p')?.textContent ?? null;

    const read = async (tag) => {
        const seen = [];
        const fresh = document.createElement(tag);

        fresh.amount = undefined;
        document.body.appendChild(fresh);
        await settle();
        seen.push(text(fresh));
        fresh.remove();

        const again = document.createElement(tag);

        document.body.appendChild(again);
        await settle();
        again.amount = 3;
        await settle();
        seen.push(text(again));
        again.amount = undefined;
        again.remove();
        await settle();
        document.body.appendChild(again);
        await settle();
        seen.push(text(again));
        again.remove();

        return seen;
    };

    expect(await read('undefined-prop-element')).toEqual(await read('undefined-prop-element-native'));
    expect(await read('undefined-prop-element-native')).toEqual(['1.5', '3', '1.5']);
});

// An entry written in `customElement.props` configures its prop, and every
// other prop is observed beside it, in Svelte's order: configuring one used to
// stop the element observing the rest, so an attribute changed after
// connection never reached them.
test('a partial props option keeps the other props, as Svelte does', async () => {
    const observed = (tag) => customElements.get(tag).observedAttributes;

    expect(observed('partial-props-element')).toEqual(observed('partial-props-element-native'));

    const read = async (tag) => {
        const element = document.createElement(tag);

        element.setAttribute('first', 'b');
        element.setAttribute('last', 'y');
        document.body.appendChild(element);
        await Promise.resolve();
        flushSync();

        try {
            element.setAttribute('last', 'x');
            element.middle = 7;
            flushSync();
            await Promise.resolve();

            return element.querySelector('p').textContent;
        } finally {
            element.remove();
        }
    };

    const native = await read('partial-props-element-native');

    expect(native).toBe('b|7|x');
    expect(await read('partial-props-element')).toEqual(native);
});

// A prop whose default calls a function of the `<script module>`, named like a
// marker of Svelthon's: the props were read off the script without the
// module's names, the call taken for the marker and the prop left without its
// type, so an attribute arrived a string.
test('a prop whose default calls a function of the module is read as the type it declares', async () => {
    const element = document.createElement('module-inspect-element');
    element.setAttribute('amount', '5');
    document.body.appendChild(element);
    await Promise.resolve();
    flushSync();

    try {
        const seen = [element.amount];

        element.setAttribute('amount', '8');
        flushSync();
        seen.push(element.amount);

        expect(seen).toEqual([5, 8]);
    } finally {
        element.remove();
    }
});

// The written-out form of the option, `customElement={{ tag, shadow }}`, gets
// the same props as the short one.
test('an element declared by the object form observes its props too', async () => {
    expect(customElements.get('object-form-element').observedAttributes).toEqual(['start']);

    const element = document.createElement('object-form-element');
    element.setAttribute('start', '5');
    document.body.appendChild(element);
    await Promise.resolve();
    flushSync();

    try {
        expect(element.querySelector('.object-form').textContent).toBe('6');

        element.setAttribute('start', '9');
        flushSync();

        expect(element.querySelector('.object-form').textContent).toBe('10');
    } finally {
        element.remove();
    }
});

// A Python element's props are its annotated names, and Svelte observes each of
// them as an attribute and exposes it as a property, converted to the type the
// annotation names. An attribute set or a property assigned after connection
// reaches Python; a name that is not a prop is not observed.
describe('a Python custom element with props', () => {
    const placed = [];

    afterEach(() => {
        while (placed.length) placed.pop().remove();
    });

    const place = async (html) => {
        const holder = document.createElement('div');
        holder.innerHTML = html;
        const element = holder.firstElementChild;
        placed.push(element);
        document.body.appendChild(element);
        await Promise.resolve();
        flushSync();
        return {
            element,
            shown: () => element.shadowRoot.querySelector('p').textContent
        };
    };

    test('observes its props and nothing else', () => {
        expect(customElements.get('typed-element').observedAttributes).toEqual(['start', 'step', 'enabled', 'tags']);
    });

    test('reads its attributes as the types they declare', async () => {
        const { shown } = await place('<typed-element start="5" step="0.5" enabled tags="[1, 2]"></typed-element>');

        expect(shown()).toBe('6|1.0|True|2');
    });

    test('and follows an attribute and a property changed afterwards', async () => {
        const { element, shown } = await place('<typed-element start="5"></typed-element>');

        element.setAttribute('start', '9');
        flushSync();
        expect(shown()).toMatch(/^10\|/);

        element.start = 20;
        flushSync();
        expect(shown()).toMatch(/^21\|/);
    });
});

// A component compiled as a custom element is usable from any page, with no
// Svelte around it — `<my-stepper>` in plain HTML, its script in Python.
//
// `host()` is the way back out. A custom element speaks to the page through DOM
// events rather than props, so without it a Python component could receive and
// render but never answer.
describe('a component compiled as a custom element', () => {
    // The element has to leave with the test that made it. A custom element
    // disconnected by the *document* going away reaches Svelte's `unmount`
    // after jsdom has taken `document` down, and the teardown throws
    // `ReferenceError: document is not defined` into an unhandled rejection.
    //
    // Measured over five full runs before this existed: three ended that way,
    // and the file alone never did. It is a race with the worker shutting down,
    // so it was intermittent, and vitest says in as many words that an unhandled
    // error "might cause false positive tests".
    const mounted = [];

    afterEach(() => {
        while (mounted.length) mounted.pop().remove();
    });

    test('registers itself under the name it declares', () => {
        expect(customElements.get('my-stepper')).toBeTypeOf('function');
    });

    test('and host() carries an event back to the page', async () => {
        const element = document.createElement('my-stepper');
        mounted.push(element);
        document.body.appendChild(element);
        await Promise.resolve();

        const seen = [];
        element.addEventListener('stepped', (event) => seen.push([event.type, event.detail]));

        const button = element.shadowRoot.querySelector('button[data-k="bump"]');
        button.click();
        button.click();
        await Promise.resolve();

        // The value leaves Python through `to_js` and arrives a JavaScript
        // number, as the page reads it.
        expect(seen).toEqual([
            ['stepped', 1],
            ['stepped', 2]
        ]);
    });

    // Svelte refuses `$host()` at compile time outside a custom element, so the
    // binding is emitted only where the name is read.
    describe('the binding is conditional', () => {
        const script = (src) => compile(src, 'Probe', 'probe.svelte', {}).script;

        test('present when the component reads it', () => {
            expect(script('def go():\n    return host()\n')).toContain("bind(__proto, 'host'");
        });

        test('absent otherwise', () => {
            expect(script('count = 0\n')).not.toContain("bind(__proto, 'host'");
        });

        // And absent when the author only wrote the *word*. The test used to be
        // a text search over the generated JavaScript, where Brython emits a
        // Python string literal as a JavaScript one: `role = "host"` became
        // `locals.role = 'host'` and the search matched its own quotation marks.
        // The component then emitted `$host()`, which Svelte refuses outside a
        // custom element, so a component holding that word in a string did not
        // render at all. A `Name` node is the question; a string is not.
        test.for([
            ['a string', 'role = "host"\n'],
            ['inside a list', 'roles = ["host", "guest"]\n'],
            ['as a dict key', 'd = {"host": 1}\n'],
            ['in a comparison', 'role = "guest"\nis_host = role == "host"\n'],
            ['in an f-string', 'n = 1\nlabel = f"{n}host"\n'],
            ['and the same for props_id', 'tag = "props_id"\n']
        ])('%s does not emit the binding', ([, src]) => {
            const out = script(src);

            expect(out).not.toContain("bind(__proto, 'host'");
            expect(out).not.toContain("bind(__proto, 'props_id'");
        });

        // Nor a name of a function's own, which reads its binding and not the
        // module's: the read that counts is one Python resolves as a global.
        test.for([
            ['a parameter', 'def label(host):\n    return host\n', false],
            ['a local', 'def label():\n    host = "x"\n    return host\n', false],
            ['a parameter a nested function reads', 'def outer(host):\n    return lambda: host\n', false],
            ['a comprehension variable', 'xs = [host for host in range(3)]\n', false],
            ['a default value, read by the module', 'def f(x=host):\n    return x\n', true],
            ['a read inside a function', 'def go():\n    return host()\n', true]
        ])('%s decides the binding by its scope', ([, src, bound]) => {
            expect(script(src).includes("bind(__proto, 'host'")).toBe(bound);
        });

        // And the whole way: a component holding the word in four ordinary
        // places renders. Compiled, it did not — Svelte answered that `$host()`
        // can only be used inside custom element component instances, about a
        // call the author never wrote.
        test('a component that only writes the word renders', () => {
            const target = document.body.appendChild(document.createElement('div'));

            mount(WordHost, { target });
            flushSync();

            const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

            expect(read('role')).toBe('host');
            expect(read('roles')).toBe("['host', 'guest']");
            expect(read('rooms')).toBe('1');
            expect(read('label')).toBe('host of the room');
        });

        // Nor in a component where a `from m import *` may bring the name: the
        // read may be the module's own `host`, and Svelte refused the whole
        // component over a `$host()` the author never wrote. A custom element
        // keeps the binding, which the star replaces when it brings one.
        test.for([
            ['a component', {}, false],
            ['a custom element', { element: true }, true]
        ])('with a star import, %s decides the binding by what it is', ([, options, bound]) => {
            const out = compile('from star_host import *\nvalue = host()\n', 'Probe', 'probe.svelte', options).script;

            expect(out.includes("bind(__proto, 'host'")).toBe(bound);
        });

        test("a component renders the `host` a star brings, as an import that names it does", () => {
            const target = document.body.appendChild(document.createElement('div'));

            mount(StarHost, { target });
            flushSync();

            expect(target.querySelector('output').textContent).toBe('own-host');
        });
    });
});
