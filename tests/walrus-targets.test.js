import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { walrus } from '../src/lib/markup.js';
import WalrusTargets from './fixtures/WalrusTargets.svelte';

// PEP 572 lets the walrus assign a name and nothing else. JavaScript's `=` takes
// a name, an attribute and a key alike, and of the 67 inline handlers in the
// Svelte tutorial, 8 write an attribute — every one of them a `.target` on a
// Tween or a Spring, which is the API of anything that moves.
//
// Svelthon's dot already finds a key as well as an attribute, reading a template
// expression and writing through `bind:`. The walrus was the one place that
// decision had not been carried, so `spring.target` needed `setattr` and nothing
// else did. This is the hole, and the companion of the tuple in
// `walrus-tuple.test.js`: that one taught the walrus to assign twice, this one
// teaches it where.
describe('what a walrus may aim at', () => {
    test.for([
        // Unchanged: a name still goes through the namespace, which is what
        // makes the signal fire.
        ['lambda: (count := count + 1)', 'lambda: __assign("count", count + 1)'],

        // An attribute, the form `Tween` and `Spring` force on a handler.
        ['lambda: (progress.target := 1)', 'lambda: __setattr(progress, "target", 1)'],

        // A key. The whole subscript is the target, so the object is what comes
        // before the last bracket.
        [
            'lambda event: (m["x"] := event.clientX)',
            'lambda event: __setitem(m, "x", event.clientX)'
        ],

        // Only the last step is assigned; the rest is the object to assign into.
        ['lambda: (a.b.c := 1)', 'lambda: __setattr(a.b, "c", 1)'],
        ['lambda: (rows[i]["done"] := True)', 'lambda: __setitem(rows[i], "done", True)'],

        // Mixed, in one tuple: the three targets side by side.
        [
            'lambda: (a := 1, b.c := 2, d[k] := 3)',
            'lambda: (__assign("a", 1), __setattr(b, "c", 2), __setitem(d, k, 3))'
        ],

        // A colon inside the key is a slice, which Python assigns to and has no
        // way to pass as an argument. Left alone, so Python reports it itself
        // rather than the rewrite emitting something that will not parse.
        ['lambda: (items[1:] := 2)', 'lambda: (items[1:] := 2)'],

        // ...but a colon inside a string is just a string.
        ['lambda: (d["a:b"] := 1)', 'lambda: __setitem(d, "a:b", 1)'],

        // Untouched, as before: a call's parenthesis is not a group, and a
        // comparison is not an assignment.
        ['lambda: f(x := 1)', 'lambda: f(x := 1)'],
        ['lambda: (a == b)', 'lambda: (a == b)'],
        ['lambda: (m[a := 1])', 'lambda: (m[a := 1])']
    ])('%s', ([source, expected]) => {
        expect(walrus(source)).toBe(expected);
    });
});

// Rewriting the text is half of it. The other half is that the write has to
// reach the signal, and for the dotted form it has to find the key rather than
// hang a JavaScript property off the dict.
describe('a walrus onto something other than a name', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(WalrusTargets, { target });
        flushSync();

        const read = (k) => target.querySelector(`p[data-k="${k}"]`).textContent;

        return {
            all: () => ['key', 'dot', 'attr', 'tally'].map(read).join(','),
            click: (k, detail = 0) => {
                target
                    .querySelector(`button[data-k="${k}"]`)
                    .dispatchEvent(new MouseEvent('click', { bubbles: true, detail }));
                flushSync();
            }
        };
    };

    test('writes a key', () => {
        const { all, click } = setup();

        expect(all()).toBe('0,0,1,0');
        click('by-key');
        expect(all()).toBe('5,0,1,0');
    });

    // A handler fires long after the expression that built it, and the dot it
    // writes through is still the template's.
    test('writes a key the dot found', () => {
        const { all, click } = setup();

        click('by-dot');
        expect(all()).toBe('0,6,1,0');
    });

    test('writes a real attribute', () => {
        const { all, click } = setup();

        click('by-attr');
        expect(all()).toBe('0,0,7,0');
    });

    // The value may come from the event, which is what a real handler does:
    // `coords.target = {x: e.clientX, y: e.clientY}` upstream.
    test('takes its value from the event', () => {
        const { all, click } = setup();

        click('by-event', 3);
        expect(all()).toBe('3,0,1,0');
    });

    test('and all three at once, in one tuple', () => {
        const { all, click } = setup();

        click('mixed');
        expect(all()).toBe('9,0,9,1');
    });
});
