import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Thrower from './fixtures/Thrower.svelte';
import ExpressionRaise from './fixtures/ExpressionRaise.svelte';

// Where an error says it happened, in both languages.
//
// The project's whole argument about messages is that a developer reads the
// line they wrote: a Brython exception reaching JavaScript carries no `message`
// and no `stack`, so `pyError` fills both in from the traceback. That half has
// been guarded since `fidelity.test.js` decoded a source map.
//
// **The half that could have been wrong is the other one.** Filling in a
// position means synthesising a frame, and a synthesiser that cannot tell whose
// error it is holding will describe an error it has no business touching — a
// JavaScript throw would come out the other side naming the component's line
// instead of its own, which is worse than saying nothing. It was measured once,
// by hand, in a real browser, and nothing in the tree held it: the fixtures that
// measurement used were scratch files, and scratch files are swept.
//
// So the claim is a test now, both halves in one file so the split is read in
// one place. The Python half is the witness: if it ever goes green while the
// JavaScript half does, the bench is measuring nothing.
describe('an error names the language it came from', () => {
    // A handler's throw escapes the DOM dispatch rather than the call, so it
    // arrives as an error event. `preventDefault` keeps the suite quiet, which
    // `tests/suite-is-quiet.test.js` counts.
    const raise = (which) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Thrower, { target });
        flushSync();

        let caught;
        const catcher = (event) => {
            caught = event.error;
            event.preventDefault();
        };

        window.addEventListener('error', catcher);
        target.querySelector(`button[data-k="${which}"]`).click();
        flushSync();
        window.removeEventListener('error', catcher);

        return caught;
    };

    // The witness. Line 10 of the fixture is the `raise`, and the sentence is
    // the project's own: the class, the message, the function, the author's file.
    test('a Python raise is described, and points at the line the author wrote', () => {
        const caught = raise('py');

        expect(caught.message).toBe(
            'ValueError: from Python, not JavaScript (raising() — tests/fixtures/Thrower.svelte:10)'
        );
        expect(caught.stack).toContain('raising() — tests/fixtures/Thrower.svelte:10');
    });

    // `toBe` rather than a pattern: what a describing boundary does is *append*,
    // so equality is the assertion. A message reading `… (crossing() —
    // Thrower.svelte:6)` would name the call instead of the throw.
    test('a JavaScript throw keeps its own sentence, with nothing appended', () => {
        expect(raise('js').message).toBe('from JavaScript, not Python');
    });

    // The deepest frame stays on top, with the column a synthesised frame cannot
    // have: `inner` threw, `explode` called it, and the component is below both.
    test('a JavaScript throw keeps its own stack, file, line and column', () => {
        const frames = raise('js')
            .stack.split('\n')
            .filter((line) => line.trim().startsWith('at '));

        expect(frames[0]).toMatch(/\bat inner\b.*thrower\.js:\d+:\d+/);
        expect(frames[1]).toMatch(/\bat explode\b.*thrower\.js:\d+:\d+/);
    });
});

// A template expression is compiled into a function appended after the script,
// so its Python line is nothing the author wrote. The error names the line of
// markup the expression sits on; and when the expression calls a function of the
// script that raises, the deepest frame is the script's, and that line is named.
describe('an error raised by a template expression', () => {
    const raise = (which) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(ExpressionRaise, { target });
        flushSync();

        let caught;
        const catcher = (event) => {
            caught = event.error;
            event.preventDefault();
        };

        window.addEventListener('error', catcher);
        target.querySelector(`button[data-k="${which}"]`).click();
        flushSync();
        window.removeEventListener('error', catcher);

        return caught.message;
    };

    test('names the line of markup it is written on', () => {
        expect(raise('inline')).toMatch(/^ZeroDivisionError: .*ExpressionRaise\.svelte:13\)$/);
    });

    // The same expression written again is reported where it was written
    // again: the two places shared one function, which reported line 13 for a
    // click on line 16.
    test('and written twice, the line of the one that ran', () => {
        expect(raise('again')).toMatch(/^ZeroDivisionError: .*ExpressionRaise\.svelte:16\)$/);
    });

    test('and a function of the script it calls names its own line', () => {
        expect(raise('called')).toMatch(/^ZeroDivisionError: .*ExpressionRaise\.svelte:7\)$/);
    });

    // Another file's line is not a line of this one: the component keeps the
    // line of the call, and the file that raised is named with its own.
    test('and a function of another module names both places', () => {
        expect(raise('elsewhere')).toMatch(
            /^ZeroDivisionError: .*ExpressionRaise\.svelte:15; raised in explode\(\), .*raising_mod\.py:4\)$/
        );
    });
});
