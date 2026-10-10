// @vitest-environment node
//
// What a Python function returns to JavaScript crosses as what a module
// exports does: a container as its view. The return was the one door still
// copying, so a list returned was a snapshot that neither side's writes reached,
// and a set arrived as Brython's internals, `{ob_type, $store, $version, $used}`.
import { test, expect } from 'vitest';
import { rows, grow, read, tags } from './fixtures/returned_views.py';

test('a returned list is the list, followed both ways and one object', () => {
    const returned = rows();

    grow();
    expect([...returned]).toEqual([1, 2, 3]);

    returned.push(4);
    expect(read()).toBe('[1, 2, 3, 4]');

    expect(rows()).toBe(returned);
});

test('a returned set is a Set, holding its members', () => {
    const returned = tags();

    expect(returned).toBeInstanceOf(Set);
    expect([...returned].sort()).toEqual([1, 2]);
    expect(returned.has(1)).toBe(true);
});
