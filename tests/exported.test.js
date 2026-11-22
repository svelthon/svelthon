import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Exposed from './fixtures/Exposed.svelte';
import ExposedHost from './fixtures/ExposedHost.svelte';
import DecoratedExport from './fixtures/DecoratedExport.svelte';
import ForeignExport from './fixtures/ForeignExport.svelte';
import ExportReboundHost from './fixtures/ExportReboundHost.svelte';
import { compile } from '../src/lib/compile.js';

// An exported name bound again is read again by the parent's page, as an
// export of a Svelte child's state is: the instance answered the new value to
// a call, and the page showed the old one until something else moved it.
test('a parent’s page follows an exported name its child binds again', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const host = mount(ExportReboundHost, { target });
    const shown = () => [target.querySelector('[data-k="shown"]').textContent, target.querySelector('[data-k="own"]').textContent];

    flushSync();
    const first = shown();
    host.handle().change();
    flushSync();
    const changed = shown();
    host.handle().restore();
    flushSync();

    expect([first, changed, shown()]).toEqual([
        ['first', 'first'],
        ['second', 'second'],
        ['first', 'first']
    ]);
});

// The one thing a parent can reach on a child that is not a prop. Svelte gathers
// whatever an instance script exports into `$$exports` and hands that object
// back; `@export` is how Python says `export function`, since Python has no
// keyword for it and a decorator keeps the mark on the function itself.
describe('@export on a component function', () => {
    const script = (src) => compile(src, 'Probe', 'src/Probe.svelte').script;

    test('emits the export Svelte reads', () => {
        expect(script('@export\ndef focus():\n    pass\n')).toContain('export { __brycomp_api_focus as focus };');
    });

    test('and only for the functions that carry it', () => {
        const out = script('@export\ndef shown():\n    pass\n\n\ndef hidden():\n    pass\n');

        expect(out).toContain('export { __brycomp_api_shown as shown };');
        expect(out).not.toContain('hidden };');
    });

    // A component that marks nothing exposes nothing, which is Svelte's own
    // rule: an instance API is opt-in.
    test('a component with none exports nothing', () => {
        expect(script('def plain():\n    pass\n')).not.toContain('export {');
    });

    // The decorator is a marker read off the AST; at run time it is the
    // identity, so the function keeps working as a function.
    test('and the function is still callable from Python', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Exposed, { target });
        flushSync();

        expect(target.querySelector('p[data-k="count"]').textContent).toBe('0');
    });
});

describe('what bind:this then holds', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Exposed, { target });
        flushSync();
        return { instance, target };
    };

    test('carries the exported function', () => {
        expect(typeof setup().instance.bump).toBe('function');
    });

    test('which runs the Python body and answers its result', () => {
        const { instance, target } = setup();

        expect(instance.bump(3)).toBe(3);
        flushSync();
        expect(target.querySelector('p[data-k="count"]').textContent).toBe('3');
    });

    test('and an act a prop could not carry', () => {
        const { instance, target } = setup();

        instance.focus();
        expect(document.activeElement).toBe(target.querySelector('input'));
    });

    test('but not what was left undecorated', () => {
        expect(setup().instance.internal).toBeUndefined();
    });

    // The same reference read from Python, which is where an author meets it:
    // `mine.bump(2)` in a parent's own code.
    test('and Python reaches it the same way', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(ExposedHost, { target });
        flushSync();

        target.querySelector('button[data-k="go"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="said"]').textContent).toBe('2 / False');
    });
});

// `export` is a marker like `derived`, `effect` and `inspect`, and every one of
// those answers to a call as well as to a decorator. Answering only to the
// decorator was an omission: `export const focus = () => …` is the shape Svelte
// itself offers beside `export function`.
describe('the call form', () => {
    test('exports the lambda it is given', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Exposed, { target });
        flushSync();

        expect(instance.doubled(21)).toBe(42);
    });

    test('and the compiler emits it beside the decorated ones', () => {
        const out = compile(
            'a = export(lambda: 1)\n\n\n@export\ndef b():\n    pass\n',
            'Probe',
            'src/Probe.svelte'
        ).script;

        expect(out).toContain('export { __brycomp_api_a as a, __brycomp_api_b as b };');
    });
});

// What the name holds, not what its `def` declared.
//
// `@export` sits on top of the author's own decorator, and the wrapper froze
// both the arity — read off the AST of the `def` — and the assumption that the
// value is still a JavaScript function. A `@collect` answering `*values` had
// three arguments in Python and one through its export; a decorator answering a
// **callable instance** raised *not a function* for a value Python calls.
//
// Both references are in the fixture, so no row is compared against a number
// written here: `from_python()` is what Python itself does with the same name.
describe('an export behind another decorator', () => {
    const ready = () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(DecoratedExport, { target });

        flushSync();

        return instance;
    };

    test('is called with what Python would give it', () => {
        const instance = ready();

        expect(instance.from_python()).toBe(3);
        expect(instance.decorated(10, 20, 30)).toBe(3);
    });

    test('and is callable when the decorator answers an instance', () => {
        expect(ready().as_object_decorated(0.25)).toBe(0.5);
    });

    // What a parent reads off the export before calling it. The mutation harness
    // named this one: the module path had the assertion and the component path,
    // which is the same line in the twin wrapper, had none.
    test('and reports the signature the value accepts, not the def’s', () => {
        const instance = ready();

        expect(instance.takes.length).toBe(2);
        expect(instance.takes(2, 3)).toBe(5);
        // And behind a decorator it is the resulting callable's, which takes
        // everything, not the `def`'s one parameter.
        expect(instance.decorated.length).toBe(0);
    });

    // A JavaScript function a decorator puts under the name reports its own
    // `length`: read off a Python signature alone, it was 0 whatever it took.
    test('and a JavaScript function’s own length, behind a decorator', () => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(ForeignExport, { target });
        flushSync();

        expect([instance.action.length, instance.action(0.25, 0.5)]).toEqual([2, 0.75]);
    });
});
