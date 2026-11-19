// A function imported from JavaScript under a marker's name, `inspect` or
// `derived`, is the author's. At the top level `answer = inspect(41)` was read as
// an inspection: the line emitted `$inspect(…)`, which Svelte read as the store
// `inspect`, and the component did not mount. Against the same component written
// in JavaScript.
import { test, expect, beforeEach } from 'vitest';
import { mount, unmount, flushSync } from './mounted.js';
import ImportedMarkers from './fixtures/ImportedMarkers.svelte';
import ImportedMarkersNative from './fixtures/ImportedMarkersNative.svelte';
import { seen } from './fixtures/imported_markers.js';
import './fixtures/ImportedInspectElement.svelte';
import ImportedDecorators from './fixtures/ImportedDecorators.svelte';
import ImportedEffectMounted from './fixtures/ImportedEffectMounted.svelte';
import ModuleInspect from './fixtures/ModuleInspect.svelte';
import ImportedHost from './fixtures/ImportedHost.svelte';
import ModuleRunes, * as moduleRunes from './fixtures/ModuleRunes.svelte';
import ModuleRunesImported, * as moduleRunesImported from './fixtures/ModuleRunesImported.svelte';
import ModuleRunesSwitch from './fixtures/ModuleRunesSwitch.svelte';
import ModuleRunesInline, * as moduleRunesInline from './fixtures/ModuleRunesInline.svelte';
import ModuleRunesAlias from './fixtures/ModuleRunesAlias.svelte';
import ModuleRunesMixed, * as moduleRunesMixed from './fixtures/ModuleRunesMixed.svelte';
import { compile } from '../src/lib/compile.js';
import ImportedBindable from './fixtures/ImportedBindable.svelte';
import ImportedBindableAlias from './fixtures/ImportedBindableAlias.svelte';
import ImportedBindableHost from './fixtures/ImportedBindableHost.svelte';

// And used as decorators, `@derived` and `@effect` over a `def`: the library's
// decorators, which hand the function back. They were read as the markers, and
// the component emitted `$derived.by` and `$effect` beside the imports, which
// Svelte read as stores, and did not mount.
test('a decorator imported under a marker name is the library s', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ImportedDecorators, { target });
    flushSync();

    expect(['answer', 'ran'].map((k) => target.querySelector(`p[data-k="${k}"]`).textContent)).toEqual(['42', '0']);
});

// And beside a hook: the import held the name `effect`, so the `$effect` the
// hook runs by was read by Svelte as a store of it, and the component did not
// mount. The import is held under another variable, which Python reads as
// `effect`.
test('an import named like a rune leaves the rune to Svelte', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ImportedEffectMounted, { target });
    flushSync();

    expect(['mounted', 'side'].map((k) => target.querySelector(`p[data-k="${k}"]`).textContent)).toEqual(['1', "the library's"]);
});

// A function of the author's JavaScript is the author's wherever it comes from:
// one the `<script module>` declares, `inspect`, was taken for the marker and
// its call refused; one `importjs` brings, `host`, was covered by Svelthon's
// helper, whose `$host()` Svelte refuses outside a custom element.
test.for([
    ['declared by the <script module>', ModuleInspect],
    ['imported by importjs, named like host()', ImportedHost]
])('a function of the author named like one of Svelthon’s, %s, is the author’s', ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    expect(target.querySelector('output').textContent).toBe('7');
});

// A name the `<script module>` binds that a rune shadows, `derived`, made every
// `$derived` the component compiles to a read of a store: `const derived = …`
// stopped the compile of any Python component, and `state` or `effect` was
// refused, where Svelte compiles a component that binds them and writes no
// such rune itself. The author's binding is held under another variable,
// exported and read by Python under its name.
test('rune names the `<script module>` binds are the author’s, the runes the component compiles to Svelte’s', () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(ModuleRunes, { target });
    flushSync();
    mount(ModuleRunesImported, { target });
    flushSync();
    // A `switch` whose case binds the name again, which its test was read
    // under, and an export on a line with no `;`, which the export said again
    // after it joined.
    mount(ModuleRunesSwitch, { target });
    flushSync();
    mount(ModuleRunesInline, { target });
    flushSync();
    // And a function declaring the variable the name was held under, which
    // then read its own where it read the module's.
    mount(ModuleRunesAlias, { target });
    flushSync();
    // And a rune name beside an ordinary one in one declaration, whose export
    // was written `undefined as caption`.
    mount(ModuleRunesMixed, { target });
    flushSync();

    expect([...target.querySelectorAll('p')].map((one) => one.textContent)).toEqual(['312|6|7|3', 'x', 'ready:local', '6', 'module:local', 'ready:card:d:l']);
    expect(['state', 'caption', 'derived', 'label'].map((name) => moduleRunesMixed[name])).toEqual(['ready', 'card', 'd', 'l']);
    expect(moduleRunesInline.derived(5)).toBe(15);
    expect([moduleRunes.derived(4), moduleRunes.state(4), moduleRunes.effect.derived]).toEqual([8, 9, 3]);

    let doubled;
    moduleRunesImported.doubled.subscribe((value) => (doubled = value))();
    expect([typeof moduleRunesImported.derived, doubled]).toEqual(['function', 4]);
});

// But a sign written with the marker the `<script module>` binds called the
// author's binding, `'str' object is not callable`, as Svelte reads the rune
// the author writes beside it as a store: refused, as an `importjs` of it is.
test.for([
    ['doubled => 1', 'derived', 'name =>'],
    ['=> print(1)', 'effect', '=>'],
    ['value: str <=>', 'bindable', '<=>']
])('`%s` beside a `<script module>` binding `%s` is refused', ([line, name, sign]) => {
    expect(() => compile(`${line}\n`, 'C', 'src/C.svelte', { jsNames: [name] })).toThrow(
        `svelthon — \`${sign}\` is written with \`${name}\`, and \`${name}\` here is the one the \`<script module>\` binds`
    );
});

// The props a custom element observes are read by a second pass over the
// script, which did not know the imports: it took `start: int = inspect(41)`
// for an inspection where the compile took it for a prop.
test('an element reads a prop whose default calls an imported inspect as the type it declares', async () => {
    const element = document.createElement('imported-inspect-element');
    element.setAttribute('start', '5');
    document.body.appendChild(element);
    await Promise.resolve();
    flushSync();

    try {
        expect(typeof element.start).toBe('number');
    } finally {
        element.remove();
    }
});

// And a default that calls an imported `bindable`: the call computes the
// default, as the same function under another name does, and the prop stays an
// ordinary one. Read as the marker, the name alone made the prop bindable, and
// the child's own write reached the parent that bound it.
test.for([
    ['under its own name', ImportedBindable],
    ['under another name, the witness', ImportedBindableAlias]
])('a prop whose default calls an imported bindable %s stays the child s', async ([, Child]) => {
    const shown = [];

    for (const bound of [false, true]) {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(ImportedBindableHost, { target, props: { Child, bound } });

        flushSync();
        instance.change();
        flushSync();
        shown.push(['parent', 'child'].map((k) => target.querySelector(`[data-k="${k}"]`).textContent).join('/'));

        await unmount(instance);
        target.remove();
    }

    const target = document.body.appendChild(document.createElement('div'));
    const alone = mount(Child, { target });

    flushSync();
    shown.push(target.textContent.trim());
    await unmount(alone);
    target.remove();

    expect(shown).toEqual(['4/5', '4/5', '8']);
});

beforeEach(() => {
    seen.length = 0;
});

test.for([
    ['Python', ImportedMarkers],
    ['JavaScript', ImportedMarkersNative]
])('in %s, each call is a call and its value is data', async ([, Component]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target });

    try {
        flushSync();

        expect(target.textContent.trim()).toBe('42:2');
        expect(seen).toEqual([41, 1]);
    } finally {
        await unmount(instance);
        target.remove();
    }
});
