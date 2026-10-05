// A name of the module that nothing bound, or that `del` removed, renders empty
// when the template reads it, as Svelte renders a value that is not there. The
// rule belongs to the template's text, as the dot's does: a function the
// template calls is Python, and reads the name as CPython does, `NameError`.
// It held for every frame under a template expression, so `except NameError`
// was not taken there and an f-string wrote `<Javascript undefined>`: the same
// function answered two things depending on who called it. The witness is the
// same function called by a handler.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import TemplateAbsence from './fixtures/TemplateAbsence.svelte';
import TemplateAbsenceSum from './fixtures/TemplateAbsenceSum.svelte';

const mounted = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(TemplateAbsence, { target });
    flushSync();

    return {
        read: (key) => target.querySelector(`[data-k="${key}"]`).textContent,
        click: () => {
            target.querySelector('button').click();
            flushSync();
        }
    };
};

test('a function the template calls reads an unbound name as Python does, as a handler sees it', () => {
    globalThis.templateAbsenceLog = [];
    const page = mounted();

    page.click();

    expect(globalThis.templateAbsenceLog).toEqual(['no total']);
    expect(page.read('call')).toBe('no total');
    expect(page.read('deleted')).toBe('no gone');
    expect(page.read('derived')).toBe('no total');
});

test('while the template reading the name itself renders it empty', () => {
    expect(mounted().read('direct')).toBe('');
});

// And so does a lambda or a generator written between the braces: the rule
// read the name of the frame, a lambda's frame is its own, and the component
// did not mount. It reads where the code is written now, while a function of
// the script the lambda calls is still Python.
test.for([
    ['lambda', ''],
    ['genexp', ''],
    ['lambda-call', 'no total']
])('as does a template %s', ([key, shown]) => {
    expect(mounted().read(key)).toBe(shown);
});

// What the template reads is None, what JavaScript's `undefined` becomes
// wherever it enters Python, and no longer `undefined` itself: an f-string
// wrote `<Javascript undefined>`, `total is None` was false, and `total + 1`
// failed inside the engine, with no position, and the component did not mount.
test.for([
    ['fstring', '[None]'],
    ['str', 'None'],
    ['is-none', 'True'],
    ['joined', 'aNone, bNone'],
    ['rendered', '']
])('read in a composed expression, the absence is None: %s', ([key, shown]) => {
    expect(mounted().read(key)).toBe(shown);
});

test('and an operation on it raises the TypeError Python raises, at its line', () => {
    const target = document.body.appendChild(document.createElement('div'));

    expect(() => mount(TemplateAbsenceSum, { target })).toThrow(/unsupported operand.*NoneType.*TemplateAbsenceSum\.svelte:7/s);
    target.remove();
});

// The rule holds while the template renders. A handler written in the template
// runs on a click, and reads the name as Python does: the same `lambda: total`
// is None while rendering and `NameError` in a handler.
test('a handler written in the template reads an unbound name as Python does', () => {
    globalThis.templateAbsenceLog = [];
    const target = document.body.appendChild(document.createElement('div'));
    mount(TemplateAbsence, { target });
    flushSync();

    target.querySelector('[data-k="handler"]').click();
    flushSync();

    expect(globalThis.templateAbsenceLog).toEqual(['NameError']);
    target.remove();
});

