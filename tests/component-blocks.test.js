// A component's scripts and styles are found where Svelte's parser finds them,
// and the markup around them is read in one piece.
//
// A `<style>` written in a Python string was taken for the component's: the
// expression was cut in two and Svelte refused the half it was handed,
// `Expected token }`. And a real `<style>` inside an `{#each}` cut the markup
// in two, the second half read with a fresh scope: `NameError: name 'row' is
// not defined`.
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { mount, flushSync } from './mounted.js';
import { pythonScript } from '../src/lib/markup.js';
import { closing_tag_omitted } from '../node_modules/svelte/src/html-tree-validation.js';
import QuotedBlocks from './fixtures/QuotedBlocks.svelte';
import TextareaMarkup from './fixtures/TextareaMarkup.svelte';
import TextareaCasedClose from './fixtures/TextareaCasedClose.svelte';
import BlocksInLoops from './fixtures/BlocksInLoops.svelte';
import BlocksInLoopsNative from './fixtures/BlocksInLoopsNative.svelte';
import ImplicitCloseDiv from './fixtures/warned/ImplicitCloseDiv.svelte';
import ImplicitCloseDivNative from './fixtures/warned/ImplicitCloseDivNative.svelte';
import ImplicitCloseSection from './fixtures/warned/ImplicitCloseSection.svelte';
import ImplicitCloseSectionNative from './fixtures/warned/ImplicitCloseSectionNative.svelte';
import ImplicitCloseHr from './fixtures/warned/ImplicitCloseHr.svelte';
import ImplicitCloseHrNative from './fixtures/warned/ImplicitCloseHrNative.svelte';

const mounted = (component) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(component, { target });
    flushSync();

    return target;
};

// What `python3` gives for each expression, and what Svelte makes of the
// attribute's text around `{name}`.
test.for([
    ['f-string style', '<style>Ada</style>'],
    ['f-string script', '<script>Ada</script>'],
    ['language', '<script lang=python>Ada</script>'],
    ['comment', 'ADA']
])('a tag quoted in %s is text', ([where, cpython]) => {
    expect(mounted(QuotedBlocks).querySelector(`[data-k="${where}"]`).textContent).toBe(cpython);
});

test('a tag quoted in an attribute is text', () => {
    expect(mounted(QuotedBlocks).querySelector('[data-k="attribute"]').title).toBe('> <style>ADA</style>');
});

// A textarea's content is text and expressions, as Svelte's parser reads it.
test('a tag written in a textarea is text', () => {
    expect(mounted(QuotedBlocks).querySelector('[data-k="textarea"]').value).toBe('<style>ADA</style>');
});

// And so a component's tag and an element's, which the markup pass read as
// markup there: `<Card />` became an `{#each}`, which Svelte refuses inside a
// textarea, and `disabled={name}` the boolean `true` where `Ada` is written.
test("a component's tag and an attribute's expression written in a textarea are text", () => {
    const target = mounted(TextareaMarkup);

    expect(['card', 'input', 'div'].map((k) => target.querySelector(`[data-k="${k}"]`).value)).toEqual([
        '<Card />',
        '<input disabled=Ada />',
        '<div hidden=Ada>text</div>'
    ]);
});

// A textarea closed as `</TEXTAREA>`, which Svelte reads as its closing tag:
// the walk stayed in the text, and read the attributes after it as text,
// `disabled` and `checked` held true where `flag` is False.
test('a textarea closed in another case ends where Svelte ends it', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const component = mount(TextareaCasedClose, { target });
    const read = () => {
        flushSync();

        return [target.querySelector('button').disabled, target.querySelector('input').checked];
    };
    const seen = [read()];

    component.toggle();
    seen.push(read());
    component.toggle();
    seen.push(read());

    expect(seen).toEqual([
        [false, false],
        [true, true],
        [false, false]
    ]);
});

// Held against the same markup with JavaScript expressions, which Svelte
// compiles as written.
test.for(['each', 'nested', 'script'])('a block inside a loop keeps its names, %s', (where) => {
    const read = (target) => target.querySelector(`[data-k="${where}"]`).textContent;

    expect(read(mounted(BlocksInLoops))).toBe(read(mounted(BlocksInLoopsNative)));
    expect(read(mounted(BlocksInLoops))).toBe('Ada:0');
});

// A `<p>` Svelte closes at the tag after it: the script that follows stands at
// the top level, as Svelte reads it, and the markup is Python. Counted open, it
// left the script nested and the markup JavaScript: `upper is not a function`.
test.for([
    ['div', ImplicitCloseDiv, ImplicitCloseDivNative],
    ['section', ImplicitCloseSection, ImplicitCloseSectionNative],
    ['hr', ImplicitCloseHr, ImplicitCloseHrNative]
])('a script after a <p> closed by <%s> is the component’s', ([, Python, Native]) => {
    const read = (component) => mounted(component).querySelector('output').textContent;

    expect(read(Python)).toBe(read(Native));
    expect(read(Python)).toBe('ADA');
});

// The copy of Svelte's rule held against Svelte's own, on every name its table
// lists: a script after `<parent>x<next>y</next>` is the component's exactly
// when Svelte closes the parent at `<next>`.
test('an element closes where Svelte closes it', () => {
    const source = readFileSync('node_modules/svelte/src/html-tree-validation.js', 'utf8');
    const from = source.indexOf('const autoclosing_children');
    const table = source.slice(from, source.indexOf('\n};', from)).replace(/\/\/.*$/gm, '');
    const field = (one) => !['direct', 'descendant', 'reset_by'].includes(one);
    const parents = [...table.matchAll(/(\w+):/g)].map((one) => one[1]).filter(field);
    const names = [...new Set([...parents, ...[...table.matchAll(/'(\w+)'/g)].map((one) => one[1])])];

    expect(parents.length).toBeGreaterThan(10);
    expect(names.length).toBeGreaterThan(30);

    for (const parent of parents) {
        for (const next of names) {
            const content = `<${parent}>x<${next}>y</${next}>\n<script lang="python">\nx = 1\n</script>`;

            expect(pythonScript(content) !== null, `<${parent}> then <${next}>`).toBe(closing_tag_omitted(parent, next));
        }
    }
});

test('a style inside a loop is an element, its attributes markup', () => {
    const read = (target) => target.querySelector('style[data-row]').dataset.row;

    expect(read(mounted(BlocksInLoops))).toBe(read(mounted(BlocksInLoopsNative)));
    expect(read(mounted(BlocksInLoops))).toBe('ADA');
});
