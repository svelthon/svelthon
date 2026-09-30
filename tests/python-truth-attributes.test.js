// The truth of a value is Python's in a template, the attributes the DOM reads
// for truth included: a boolean attribute of HTML, and `class`, which Svelte
// hands to `clsx`. An empty list is false, and so is an object whose
// `__bool__` says so; `None` in a class list is nothing, not its engine fields.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import PythonTruthAttributes from './fixtures/PythonTruthAttributes.svelte';

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
    ['open', 'open']
])('a boolean attribute given a false Python value is off: %s', ([key, property]) => {
    expect(at()(key)[property]).toBe(false);
});

test('control: a true Python value turns it on', () => {
    expect(at()('witness').disabled).toBe(true);
});

// `hidden` keeps its third state, `until-found`, written directly or spread,
// and from a subclass of str; any other value is Python's truth.
test.for([
    ['until-found', 'until-found'],
    ['until-found-spread', 'until-found'],
    ['until-found-subclass', 'until-found'],
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
