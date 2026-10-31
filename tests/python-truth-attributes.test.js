// The truth of a value is Python's in a template, the attributes the DOM reads
// for truth included: a boolean attribute of HTML, and `class`, which Svelte
// hands to `clsx`. An empty list is false, and so is an object whose
// `__bool__` says so; `None` in a class list is nothing, not its engine fields.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PythonTruthAttributes from './fixtures/PythonTruthAttributes.svelte';
import PythonTruthBindings from './fixtures/PythonTruthBindings.svelte';
import PythonTruthBindingsNative from './fixtures/PythonTruthBindingsNative.svelte';
import DefaultCheckedTruth from './fixtures/DefaultCheckedTruth.svelte';
import DefaultCheckedTruthNative from './fixtures/DefaultCheckedTruthNative.svelte';

const at = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(PythonTruthAttributes, { target });
    flushSync();
    return (key) => target.querySelector(`[data-k="${key}"]`);
};

test.for([
    ['hidden', 'hidden'],
    ['disabled', 'disabled'],
    ['checked', 'checked'],
    ['required', 'required'],
    ['open', 'open'],
    // One of the names Svelte reads as boolean that the table had left out,
    // written directly, spread, and spread as None.
    ['indeterminate', 'indeterminate'],
    ['indeterminate-spread', 'indeterminate']
])('a boolean attribute given a false Python value is off: %s', ([key, property]) => {
    expect(at()(key)[property]).toBe(false);
});

// None spread after a true value reached Svelte as an absence, which leaves a
// property as it was: the box stayed indeterminate. None is Python's false
// wherever the attribute is written, so it turns the box off, spread as
// written directly; Svelte's own spread of `null` leaves it on, and only its
// `indeterminate={null}` written directly turns it off.
test('a boolean spread as None after a true value is off', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(PythonTruthAttributes, { target });
    flushSync();
    const box = target.querySelector('[data-k="indeterminate-cleared"]');

    expect(box.indeterminate).toBe(true);
    instance.clear();
    flushSync();
    expect(box.indeterminate).toBe(false);
});

test('control: a true Python value turns it on', () => {
    expect(at()('witness').disabled).toBe(true);
});

// `hidden` keeps its third state, `until-found`, written directly or spread,
// from a subclass of str, and on a `<svelte:element>`, whose attribute is read
// as it renders; any other value is Python's truth.
test.for([
    ['until-found', 'until-found'],
    ['until-found-spread', 'until-found'],
    ['until-found-subclass', 'until-found'],
    ['until-found-element', 'until-found'],
    ['hidden-true', ''],
    ['hidden-other-text', '']
])('hidden: %s', ([key, attribute]) => {
    expect(at()(key).getAttribute('hidden')).toBe(attribute);
});

test('class from a dict keeps the names whose value Python finds true', () => {
    expect(at()('dict').className).toBe('shown');
});

test('class from a list keeps the names Python finds true, and nothing of None', () => {
    expect(at()('list').className).toBe('base');
});

// One rule, however the attribute is written: by its shorthand, as a lone
// interpolation between quotes, on `<svelte:element>`, or through a spread.
test.for([
    ['the shorthand', 'shorthand'],
    ['a quoted interpolation', 'quoted'],
    ['<svelte:element>', 'element'],
    ['a spread', 'spread']
])('a false hidden written through %s is off', ([, key]) => {
    expect(at()(key).hidden).toBe(false);
});

test.for([
    ['a quoted interpolation', 'quoted-class'],
    ['<svelte:element>', 'element'],
    ['a spread', 'spread']
])('a class list written through %s keeps what Python finds true', ([, key]) => {
    expect(at()(key).className).toBe('a');
});

test('control: class from a string is the string', () => {
    expect(at()('text').className).toBe('plain words');
});

// And a binding Svelte reads for truth, on an element: `bind:checked`,
// `indeterminate`, `open`, `muted` and `paused` were handed a container or an
// object as JavaScript holds it, true whatever Python found, so an empty list
// checked its box and an object whose `__bool__` says False opened a
// `<details>`. Each as a Svelte component bound to the Python value's truth
// shows it, None as one bound to `undefined`, from which both read the element.
test.for([['list'], ['dict'], ['tuple'], ['set'], ['object'], ['full'], ['none']])(
    'a binding read for truth takes Python’s, as Svelte bound to it does: %s',
    ([kind]) => {
        const played = [];
        const play = HTMLMediaElement.prototype.play;

        HTMLMediaElement.prototype.play = function () {
            played.push(this.dataset.k);
            return Promise.resolve();
        };

        // What a media element is asked to do is what `paused` shows: jsdom
        // plays nothing, and leaves `paused` as it was.
        const shown = (Component, props) => {
            played.length = 0;

            const target = document.body.appendChild(document.createElement('div'));
            const instance = mount(Component, { target, props });

            flushSync();

            const read = (key, property) => target.querySelector(`[data-k="${key}"]`)[property];
            const state = [read('checked', 'checked'), read('indeterminate', 'indeterminate'), read('open', 'open'), read('muted', 'muted')];

            return { state, played: [...played], model: instance.model() };
        };

        try {
            const truth = kind === 'none' ? undefined : kind === 'full';
            const native = shown(PythonTruthBindingsNative, { truth });
            const python = shown(PythonTruthBindings, { kind });

            expect([python.state, python.played]).toEqual([native.state, native.played]);
            if (kind === 'none') expect(python.model).toEqual(native.model);
        } finally {
            HTMLMediaElement.prototype.play = play;
        }
    }
);

// `defaultChecked`, a property Svelte sets and no attribute spells, was read
// as JavaScript's truth, written by name, quoted or spread: an object whose
// `__bool__` says False checked its box, a binding read from the box took
// `True`, and a form's reset checked it again. Each as Svelte given the truth
// Python finds, after a reset too.
test.for([[false], [true]])('defaultChecked takes Python’s truth, as Svelte given it does: %s', ([full]) => {
    const shown = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Component, { target, props: { full } });
        flushSync();

        const boxes = () => [...target.querySelectorAll('input')].map((one) => [one.checked, one.defaultChecked]);
        const initial = boxes();
        const model = instance.model();

        target.querySelectorAll('input').forEach((one) => (one.checked = !full));
        target.querySelector('form').reset();
        flushSync();

        return { initial, model, reset: boxes() };
    };

    expect(shown(DefaultCheckedTruth)).toEqual(shown(DefaultCheckedTruthNative));
});
