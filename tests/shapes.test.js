import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import Shapes from './fixtures/Shapes.svelte';

// The same record in both shapes — a class instance and a dict — put through
// every place it can be read or handed on. What differs between them is not
// taste, and the cells below measure it.
describe('a record as an object and as a dict', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(Shapes, { target });
        flushSync();

        return {
            text: (k) => target.querySelector(`[data-k="${k}"]`).textContent,
            attribute: (k) => target.querySelector(`[data-k="${k}"]`).getAttribute('title'),
            bump: () => {
                target.querySelector('[data-k="bump"]').click();
                flushSync();
            }
        };
    };

    test('both read in the markup', () => {
        const { text } = setup();
        expect(text('read-obj')).toBe('Making the GIL Optional');
        expect(text('read-dic')).toBe('Making the GIL Optional');
    });

    test('both read inside an attribute, quotes and all', () => {
        const { attribute } = setup();
        expect(attribute('attr-obj')).toBe('Making the GIL Optional');
        // `title={dic["title"]}` — the quotes sit inside a quoted attribute and
        // the markup scanner keeps its bearings.
        expect(attribute('attr-dic')).toBe('Making the GIL Optional');
    });

    test('only an object has a computed field', () => {
        expect(setup().text('prop-only')).toBe('https://peps.python.org/pep-0703/');
    });

    test('both are reactive when mutated in place', () => {
        const { text, bump } = setup();
        bump();
        expect(text('year-obj')).toBe('2024');
        expect(text('year-dic')).toBe('2024');
    });

    test('both keep their shape as a component prop', () => {
        const { text } = setup();
        expect(text('prop-obj')).toBe('Pep');
        expect(text('prop-dic')).toBe('dict');
    });

    // The function read off a module is the Python function itself, so neither
    // shape is converted on the way in. tests/crossing.test.js holds the grid.
    test('an object and a dict survive a call into another module', () => {
        expect(setup().text('cross-obj')).toBe('Pep dict=False');
        expect(setup().text('cross-dic')).toBe('dict dict=True');
    });

    test('a dict spreads into a child as props', () => {
        expect(setup().text('spread-dic')).toBe('703 Making the GIL Optional 2023');
    });

    // And an object: its attributes lived under a private symbol, so the spread
    // found none and the child fell back on its defaults. A spread takes what
    // `**rest` takes of an instance, its attributes.
    test('and so does an object', () => {
        expect(setup().text('spread-obj')).toBe(setup().text('spread-dic'));
    });
});

// The same page written both ways. Whatever the two shapes cost elsewhere, what
// they put on screen is identical — which makes comparing them a comparison of
// costs rather than of results.
describe('the same page in both shapes', () => {
    const render = async (which) => {
        const { default: Component } = await import(`./fixtures/Peps${which}.svelte`);
        const target = document.body.appendChild(document.createElement('div'));
        mount(Component, { target });
        flushSync();
        return target.innerHTML;
    };

    test('renders the same markup', async () => {
        const object = await render('Object');
        const dict = await render('Dict');

        expect(object).toContain('PEP 703');
        expect(object).toContain('https://peps.python.org/pep-0008/');
        // Svelte scopes styles per component, so the class attribute differs;
        // nothing else may.
        expect(dict.replace(/ class="s-[^"]*"/g, '')).toBe(object.replace(/ class="s-[^"]*"/g, ''));
    });
});
