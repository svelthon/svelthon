// A group value can be written four ways and the compiler treated two of them as
// one. `tagValue` read only the braced spelling and left the quoted one to the
// node, on a sentence that was wrong twice:
//
//   "`value="a"` is text, `value="{x}"` is text too, since Svelte concatenates a
//    quoted attribute, and the node's own value is exactly right for both."
//
// Measured against Svelte, neither half holds. `value="{n}"` binds the **number**
// — Svelte treats a lone interpolation exactly as the braced spelling, so
// reading the node gave the group the string `"1"`, which is the very failure
// the braced path exists to avoid. And `value="a-{n}"` is a concatenation that
// *moves*: reading it off the node meant reading it whenever the action happened
// to run, which is not ordered against Svelte writing the attribute, so a click
// wrote `item-first` into Python while the field read `item-second`, with
// nothing raised.
//
// So the rows are the four spellings plus static text, each measured twice —
// once as written, once after the names underneath have changed — and **the
// reference is Svelte**, read off the same markup in its own language rather
// than written out here. A literal would pin today's rule; the witness tells us
// the day the rule moves.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import GroupQuoted from './fixtures/GroupQuoted.svelte';
import GroupQuotedNative from './fixtures/GroupQuotedNative.svelte';

const SPELLINGS = [
    ['one interpolation alone', 'one'],
    ['text around an interpolation', 'mixed'],
    ['two interpolations', 'two'],
    ['a braced expression', 'braced'],
    ['static text', 'static']
];

// Select the input, then change what its value is built from, and report the
// three things a group binding owes: what the field says, what the model holds,
// and whether the control is still filled.
const measure = (Component, key) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const input = target.querySelector(`input[data-k="${key}"]`);
    const held = () => target.querySelector(`p[data-k="${key}"]`).textContent;

    input.click();
    flushSync();
    const chosen = held();

    target.querySelector('button[data-k="change"]').click();
    flushSync();

    return `chose ${chosen}, then value=${input.value} held=${held()} checked=${input.checked}`;
};

describe.for(SPELLINGS)('a group value written as %s', ([, key]) => {
    test('behaves as Svelte behaves on the same markup', () => {
        expect(measure(GroupQuoted, key)).toBe(measure(GroupQuotedNative, key));
    });
});

// And the type, which the witness above cannot check: it reads through a `<p>`,
// where a number and its spelling look the same. This is the half `group-values`
// already guards for the braced spelling, asked of the quoted one.
test('a lone interpolation binds the value, not its spelling', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(GroupQuoted, { target });
    flushSync();

    target.querySelector('input[data-k="one"]').click();
    flushSync();

    expect(instance.kind('one')).toBe('int');
    expect(instance.kind('mixed')).toBe('str');
});
