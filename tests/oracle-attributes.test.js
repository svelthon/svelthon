import { test, expect } from 'vitest';
import { cpython, mounted } from './oracle.js';
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
const expected = cpython('OracleAttributes.svelte');

// CPython refuses some writes, `object.__setattr__` on a class say, and those
// are no case. A driver that refused them all would leave nothing to compare.
test('the oracle has its cases', () => {
    expect(Object.keys(expected).length).toBeGreaterThan(1000);
});

test.for(Object.keys(expected))('%s', (kind) => {
    const { models, pages } = mounted(OracleAttributes, kind, (instance, target, step) => {
        if (!kind.endsWith('|binding')) return instance.change(step);

        const field = target.querySelector('input');
        field.value = String(step);
        field.dispatchEvent(new Event('input'));
    });

    expect(models, 'the model, against CPython').toEqual(expected[kind]);
    expect(pages, 'the page, against the model').toEqual(models);
});
