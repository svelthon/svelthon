// **Gathering an element's attributes into a dict must not change what they
// mean.**
//
// A spread was a shallow copy and nothing more, so a `None` inside one reached
// the DOM as the Python object it is. `title={None}` removed the attribute and
// the same None under a key wrote the word `None` into it; `{**{"disabled":
// None}}` disabled a control nobody had disabled, and the reader was left with
// a form they could not fill in. No compilation error, no exception, and the
// page looked deliberate.
//
// `bound` is the rule — *only None, and Zero, an empty string and False are
// values a binding must keep* — and it was written twenty lines above the
// branch that did not ask it. The spread is the second site that hands an
// attribute to the DOM.
//
// So the rows are the two spellings of the same attributes, compared against
// each other and against Svelte executed on the same markup in its own
// language, before and after a value that is there becomes a value that is not.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import SpreadAbsence from './fixtures/SpreadAbsence.svelte';
import SpreadAbsenceNative from './fixtures/SpreadAbsenceNative.svelte';

const after = (Component, clicks) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    for (const key of clicks) {
        target.querySelector(`[data-k="${key}"]`).click();
        flushSync();
    }

    const shown = (key) => {
        const node = target.querySelector(`[data-k="${key}"]`);

        return {
            // Without `data-k`, which is how the test reaches the element and
            // the one attribute the two spellings are meant to differ on.
            written: Object.fromEntries(
                [...node.attributes]
                    .filter((one) => one.name !== 'data-k')
                    .map((one) => [one.name, one.value])
            ),
            disabled: node.disabled === true
        };
    };

    return {
        spread: shown('spread'),
        direct: shown('direct'),
        kept: shown('kept'),
        presses: target.querySelector('[data-k="presses"]').textContent
    };
};

describe.for([[[]], [['erase']], [['kept']], [['kept', 'erase']]])('clicking %s', ([clicks]) => {
    test('gives what Svelte gives for the same markup', () => {
        expect(after(SpreadAbsence, clicks)).toEqual(after(SpreadAbsenceNative, clicks));
    });

    // The comparison cannot say on its own that both are the right answer
    // rather than the same wrong one: the two spellings are the defect.
    test('and the gathered attributes say what the written ones say', () => {
        const read = after(SpreadAbsence, clicks);

        expect(read.spread).toEqual(read.direct);
    });
});

// The witnesses the comparison needs beside it, on the values themselves.
describe('what a spread carries', () => {
    test('a value that is there', () => {
        const { spread } = after(SpreadAbsence, []);

        expect(spread.written.title).toBe('set');
        expect(spread.disabled).toBe(true);
    });

    test('and a value that is not', () => {
        const { spread } = after(SpreadAbsence, ['erase']);

        expect(spread.written.title).toBe(undefined);
        expect(spread.disabled).toBe(false);
    });

    // Absence is None and nothing else. An empty string is an attribute that is
    // there and says nothing, `0` is a number, and `False` is the word "false":
    // converting any of those would be a second defect wearing the first one's
    // clothes.
    test('while the empty string, zero and False are values it keeps', () => {
        const { kept } = after(SpreadAbsence, []);

        expect(kept.written.title).toBe('');
        expect(kept.written['data-n']).toBe('0');
        expect(kept.written['aria-hidden']).toBe('false');
    });

    test('and a callback under a key is still a handler', () => {
        expect(after(SpreadAbsence, ['kept', 'kept']).presses).toBe('2');
    });
});
