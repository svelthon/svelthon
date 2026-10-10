import { test, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mount, flushSync } from './mounted.js';
import OracleAttributes from './fixtures/OracleAttributes.svelte';

// The differential oracle: the fixture's own Python, run by CPython case by
// case (`tests/oracle.py`), against the same script mounted. A case is a holder,
// a read and a write, so a rule closed for one of them is checked on all: the
// read through `super()` and the one through a metaclass were each found by an
// audit after the read through an instance had been made to repaint.
//
// Two questions per case, kept apart because they are two defects: the model
// against CPython, which is Python's semantics, and the page against the model,
// which is what repaints.
const expected = JSON.parse(
    execFileSync('python3', ['tests/oracle.py', 'tests/fixtures/OracleAttributes.svelte'], { encoding: 'utf8' })
);

// CPython refuses some writes, `object.__setattr__` on a class say, and those
// are no case. A driver that refused them all would leave nothing to compare.
test('the oracle has its cases', () => {
    expect(Object.keys(expected).length).toBeGreaterThan(1000);
});

test.for(Object.keys(expected))('%s', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(OracleAttributes, { target, props: { kind } });
    const binding = kind.endsWith('|binding');
    const models = [];
    const pages = [];

    const seen = () => {
        flushSync();
        models.push(instance.model());
        pages.push(target.querySelector('output').textContent);
    };

    seen();
    for (const step of [1, 2]) {
        if (binding) {
            const field = target.querySelector('input');
            field.value = String(step);
            field.dispatchEvent(new Event('input'));
        } else {
            instance.change(step);
        }
        seen();
    }

    expect(models, 'the model, against CPython').toEqual(expected[kind]);
    expect(pages, 'the page, against the model').toEqual(models);
});
