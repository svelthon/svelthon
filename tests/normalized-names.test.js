// An identifier is read in its NFKC form, as Python reads one, in the markup as
// in the script: `box.ﬁeld` is `box.field`, and an accent written in two code
// points is the one written in one. The engine read the spelling as written and
// raised `AttributeError`; once it read the normalized name, the markup pass
// looked for the dot `field`'s length behind the end of `ﬁeld`, one character
// too far, and refused the component.
//
// And a name the markup declares is compared so too: `{#each … as ﬁeld}` then
// `{field}` handed the expression nothing and raised `NameError`, and
// `(ｃｏｕｎｔ := …)` wrote a namespace key no name reads, leaving `count` at 0.
// The variable keeps the spelling it was declared under, which is the one
// JavaScript knows it by.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { preprocess } from 'svelte/compiler';
import { python } from '../src/lib/svelthon.js';
import NormalizedNames from './fixtures/NormalizedNames.svelte';
import NormalizedModuleNames from './fixtures/NormalizedModuleNames.svelte';

const mounted = () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(NormalizedNames, { target });
    flushSync();

    return target;
};

test.for([
    ['ligature', 'field'],
    ['decomposed', 'composed'],
    ['lambda', 'field'],
    ['each', 'OK'],
    ['each back', 'OK'],
    ['snippet', 'OK'],
    // A snippet declared under one spelling and rendered under another: its
    // name went to Svelte as written, two JavaScript names for one Python name.
    ['snippet declared with a ligature', 'OK'],
    ['snippet rendered with a ligature', 'OK'],
    ['snippet declared full width', 'OK'],
    ['snippet rendered full width', 'OK'],
    ['declared', 'OK'],
    ['bound', 'a']
])('a name spelled another way reads the same name: %s', ([k, expected]) => {
    expect(mounted().querySelector(`[data-k="${k}"]`).textContent).toBe(expected);
});

test('a binding writes the declared name under another spelling', () => {
    const target = mounted();
    const field = target.querySelector('[data-k="bind"]');

    field.value = 'typed';
    field.dispatchEvent(new Event('input'));
    flushSync();

    expect(target.querySelector('[data-k="bound"]').textContent).toBe('typed');
});

// Two spellings of one name in nested scopes are one name, the inner hiding the
// outer as in Python: both were handed to the expression, which Brython refused
// as a duplicate parameter, and the component did not compile.
test.for([
    ['hidden', 'inner'],
    ['outer again', 'outer'],
    ['hidden back', 'inner'],
    ['hidden by a snippet', 'inner']
])('an inner spelling hides the outer one: %s', ([k, expected]) => {
    expect(mounted().querySelector(`[data-k="${k}"]`).textContent).toBe(expected);
});

test('a binding writes the name the inner scope declares', () => {
    const target = mounted();
    const field = target.querySelector('[data-k="bind hidden"]');

    field.value = 'typed';
    field.dispatchEvent(new Event('input'));
    flushSync();

    expect([
        target.querySelector('[data-k="inner box"]').textContent,
        target.querySelector('[data-k="outer box"]').textContent
    ]).toEqual(['typed', 'field']);
});

test('a walrus writes the script name under another spelling', () => {
    const target = mounted();

    target.querySelector('button').click();
    flushSync();

    expect(target.querySelector('output').textContent).toBe('1');
});

// And a name of the `<script module>`, published under the name Python reads:
// it was published as JavaScript spells it, and both spellings raised
// `NameError`. Read off the variable as JavaScript spells it.
test.for([
    ['ligature', '7'],
    ['ligature, spelled plain', '7'],
    ['full width', '8'],
    ['kelvin', '9'],
    ['builtin', '10']
])('a name of the module script spelled another way reads it: %s', ([k, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(NormalizedModuleNames, { target });
    flushSync();

    expect(target.querySelector(`[data-k="${k}"]`).textContent).toBe(expected);
});

// Two of its names Python reads as one are refused: which one the template
// reaches would be nobody's choice.
test('two names of the module script that Python reads as one are refused', async () => {
    const source = '<script module>\n    const ﬁeld = 1;\n    const field = 2;\n</script>\n\n<script lang="python">\npass\n</script>\n\n<p>{field}</p>\n';

    await expect(preprocess(source, [python()], { filename: 'Twice.svelte' })).rejects.toThrow(
        '`ﬁeld` and `field` are two JavaScript names Python reads as one'
    );
});
