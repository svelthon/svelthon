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
        // An attribute named as Python reads the name, and a walrus inside the
        // key or the receiver rewritten as one in the value is.
        ['lambda: (box.ﬁeld := 1)', 'lambda: __setattr(box, "field", 1)'],
        ['lambda: (rows[(chosen := 1)] := 7)', 'lambda: __setitem(rows, __assign("chosen", 1), 7)'],
        ['lambda: (boxes[(chosen := 1)].width := 7)', 'lambda: __setattr(boxes[__assign("chosen", 1)], "width", 7)'],

        // Mixed, in one tuple: the three targets side by side.
        [
            'lambda: (a := 1, b.c := 2, d[k] := 3)',
            'lambda: (__assign("a", 1), __setattr(b, "c", 2), __setitem(d, k, 3))'
        ],

        // A colon inside the key is a slice, which Python assigns to and passes
        // as an argument spelt `slice(start, stop, step)`, under the compiler's
        // name, a bound left out being `None`; one per part of a tuple key.
        ['lambda: (items[1:] := 2)', 'lambda: __setitem(items, __slice(1, None), 2)'],
        ['lambda: (grid[::2, 0] := 2)', 'lambda: __setitem(grid, (__slice(None, None, 2), 0), 2)'],

        // ...but each `lambda` takes the next colon, as Python reads it, before
        // or after a slice's own, or with none at all.
        ['lambda: (d[1:lambda: 2] := 1)', 'lambda: __setitem(d, __slice(1, lambda: 2), 1)'],
        ['lambda: (d[lambda: 1:2] := 1)', 'lambda: __setitem(d, __slice(lambda: 1, 2), 1)'],
        ['lambda: (d[1 if True else lambda: 2] := 1)', 'lambda: __setitem(d, 1 if True else lambda: 2, 1)'],

        // A `:=` alone between the brackets is the key it binds, written as the
        // parenthesised one is, the component's name with it.
        ['lambda: (items[i := 0] := 9)', 'lambda: __setitem(items, __assign("i", 0), 9)'],

        // ...but a colon inside a string is just a string.
        ['lambda: (d["a:b"] := 1)', 'lambda: __setitem(d, "a:b", 1)'],

        // Untouched, as before: a call's parenthesis is not a group, and a
        // comparison is not an assignment.
        ['lambda: f(x := 1)', 'lambda: f(x := 1)'],
        ['lambda: (a == b)', 'lambda: (a == b)'],
        ['lambda: (m[a := 1])', 'lambda: (m[a := 1])'],

        // An f-string's fields are code, its text is not. A field ending in `=`
        // prints its own text, kept in a string field of its own, then the value
        // with the `!r` the `=` implies when nothing else is said.
        ['lambda: f"{(n := 1)}"', 'lambda: f"{__assign("n", 1)}"'],
        ['lambda: f"{(n := 1)!s:>3}"', 'lambda: f"{__assign("n", 1)!s:>3}"'],
        ['lambda: f"{x:{(w := 4)}}"', 'lambda: f"{x:{__assign("w", 4)}}"'],
        ['lambda: f"{ (n := 1) = }"', 'lambda: f"{" (n := 1) = "}{ __assign("n", 1) !r}"'],
        ['lambda: f"{(n := 1)=:>3}"', 'lambda: f"{"(n := 1)="}{__assign("n", 1):>3}"'],
        ['lambda: f"{(n := 1)=!s}"', 'lambda: f"{"(n := 1)="}{__assign("n", 1)!s}"'],
        ['lambda: f"{n}{n == 1}{n=}"', 'lambda: f"{n}{n == 1}{n=}"'],
        ['lambda: f"(n := 1) {{(n := 1)}}"', 'lambda: f"(n := 1) {{(n := 1)}}"'],
        ['lambda: "{(n := 1)}"', 'lambda: "{(n := 1)}"']
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

    // `box.ﬁeld` is `box.field` to Python, on an instance and through the dot
    // on a dict, where a second attribute was made or a missing key refused.
    test('writes the attribute a ligature names', () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(WalrusTargets, { target });
        flushSync();

        target.querySelector('button[data-k="by-ligature"]').click();
        flushSync();

        expect(target.querySelector('p[data-k="field"]').textContent).toBe('3|4');
    });

    // A walrus inside the key or the receiver of the target writes the
    // component's name, as one in the value does: `chosen` stayed 0.
    test.for(['nested-key', 'nested-receiver'])('a walrus inside the %s of a target writes the name', (k) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(WalrusTargets, { target });
        flushSync();

        target.querySelector(`button[data-k="${k}"]`).click();
        flushSync();

        expect(target.querySelector('p[data-k="nested"]').textContent).toBe(k === 'nested-key' ? '1|7|1' : '1|0|8');
    });

    // The texts are CPython's for the same f-strings with `chosen` a global.
    test.for([
        ['in-field', '1|1'],
        ['in-debug', '5|(chosen := 5)=5'],
        ['in-spec', '6|(chosen := 6)=  6']
    ])('a walrus in an f-string field writes the name: %s', ([k, shown]) => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(WalrusTargets, { target });
        flushSync();

        target.querySelector(`button[data-k="${k}"]`).click();
        flushSync();

        expect(target.querySelector('p[data-k="formatted"]').textContent).toBe(shown);
    });
});
