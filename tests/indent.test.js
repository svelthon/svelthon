import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Indented from './fixtures/Indented.svelte';
import Tabbed from './fixtures/Tabbed.svelte';

// A `<script>` body sits inside markup, and every Svelte example indents it one
// level. In JavaScript that is whitespace; in Python it is syntax, and the block
// raises `IndentationError: unexpected indent` — pointing, in Brython, at the
// line *after* the last one, which tells the author nothing.
//
// Brython already solves this for its own `<script type="text/python">`, so the
// vendored build exposes that same function rather than carrying a second copy
// of the rule. Its bail is conservative: one non-blank line already at column
// zero and the source is returned untouched.
describe('an indented script body', () => {
    const setup = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();

        return (k) => target.querySelector(`[data-k="${k}"]`)?.textContent;
    };

    test('compiles and runs, indented with spaces', () => {
        expect(setup(Indented)('name')).toBe('World');
    });

    test('and indented with tabs', () => {
        expect(setup(Tabbed)('label')).toBe('TABBED');
    });

    // The dedent has to reach inside a string too: the author indented the whole
    // block, so the content they meant is the content without that indentation.
    test('a triple-quoted string loses the block’s indentation, and nothing else', () => {
        expect(setup(Indented)('text')).toBe('one\ntwo');
    });

    // `importjs` wants column zero, so the dedent must run before it — which is
    // exactly where an indented author's statement lands afterwards.
    test('importjs still works from an indented block', () => {
        expect(setup(Indented)('js')).toBe('yes');
    });

    // The property that makes the whole thing free: whitespace is removed, never
    // a line. `raise` is on line 10 of the file and must be reported there.
    test('the line numbers are untouched', () => {
        setup(Indented);

        let reported;
        const catcher = (event) => {
            reported = event.error ? event.error.message : event.message;
            event.preventDefault();
        };

        window.addEventListener('error', catcher);
        document.querySelector('button[data-k="boom"]').click();
        flushSync();
        window.removeEventListener('error', catcher);

        expect(reported).toMatch(/Indented\.svelte:10/);
    });
});
