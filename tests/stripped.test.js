import { test, expect, describe, beforeEach } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Stripped from './fixtures/Stripped.svelte';

// Jinja's `|striptags`, done with the browser's parser instead of a regex.
// Every case below is one the regex — Django's and Jinja's — gets wrong, and
// two of them are ordinary content rather than an edge case: entities are left
// undecoded, and markup escapes through an attribute holding a `>`.
describe('striptags', () => {
    // Once per test rather than once per file, so the component is torn down
    // with the test that made it.
    let out;
    let read;

    beforeEach(() => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Stripped, { target });
        flushSync();

        out = (i) => target.querySelector(`p[data-k="out-${i}"]`).textContent;
        read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
    });

    test('tags go, text stays', () => {
        expect(out(0)).toBe('Bonjour le monde');
    });

    test('entities are decoded — the regex leaves `caf&eacute;`', () => {
        expect(out(1)).toBe('café & thé');
    });

    test('an attribute holding a `>` does not leak markup', () => {
        // The regex gives `b" src="x"> suite`.
        expect(out(2)).toBe('suite');
    });

    // Three positions for one element, because the answer used to depend on
    // where it stood: a `<script>` opening the fragment lands in `<head>`, which
    // this helper does not read, so the rule held by an accident of parsing. The
    // same element between two words lands in `<body>` and printed `alert("x")`
    // into the page.
    test.for([
        ['opening the fragment', 3, 'après'],
        ['between two words', 9, 'Bonjour monde'],
        ['a style, in the same place', 10, 'Bonjour monde']
    ])('a script keeps neither its tags nor its source, %s', ([, at, written]) => {
        // The regex — Django's and Jinja's — keeps what the script holds, and
        // this is the line where the project takes its own answer: what a
        // template wants is the visible document.
        expect(out(at)).toBe(written);
    });

    test('a bare `<` in the text is not a tag', () => {
        // The regex truncates at it: `a &lt; b et 3 `.
        expect(out(4)).toBe('a < b et 3 < 4');
    });

    test('a comment goes', () => {
        expect(out(5)).toBe('visible');
    });

    test('runs of whitespace collapse, as Jinja does', () => {
        expect(out(6)).toBe('Bonjour le monde');
    });

    test('and no separator is invented between blocks, as Jinja does not', () => {
        expect(out(7)).toBe('ab');
    });

    test('text without markup is left alone', () => {
        expect(out(8)).toBe('texte sans balise');
    });

    test('a value that is not a string goes through str() first', () => {
        expect(read('number')).toBe('703');
    });
});
