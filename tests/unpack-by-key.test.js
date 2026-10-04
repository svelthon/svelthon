// `{#each rows as {id, name}}` unpacks a row by key, and the README gives it as
// the shorter spelling of `{row.id}`, `{row.name}`. It was handed to Svelte as
// written, so JavaScript destructured the row: a dict, whose string keys are own
// properties, came out right; an instance, which keeps its attributes under a
// symbol, came out as empty cells; and a misspelt key was `undefined`, rendered
// as nothing, where the dot raises the AttributeError.
//
// Each key is now read by the dot's rule. Svelte's own unpacking is the witness:
// there, `{id, name}` and `{row.id}` agree on every row, and so must ours.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import UnpackByKey from './fixtures/UnpackByKey.svelte';
import UnpackByKeyNative from './fixtures/UnpackByKeyNative.svelte';
import UnpackByKeyTypo from './fixtures/UnpackByKeyTypo.svelte';

const mounted = (Component) => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(Component, { target });
    flushSync();

    const read = () =>
        Object.fromEntries([...target.querySelectorAll('p')].map((one) => [one.dataset.k, one.textContent]));
    const click = (name) => {
        target.querySelector(`.${name}`).click();
        flushSync();
    };
    const keyed = () => [...target.querySelectorAll('[data-k="keyed"] b')];

    return { read, click, keyed };
};

// What both languages say, row by row: `rest` is Python's alone, since a
// JavaScript object has no dict to hand back.
const shared = (rows) => Object.fromEntries(Object.entries(rows).filter(([k]) => k !== 'rest'));

describe('a row unpacked by key', () => {
    test('reads what the dot reads, on a dict and on an instance, as in Svelte', async () => {
        const ours = mounted(UnpackByKey);
        const theirs = mounted(UnpackByKeyNative);

        await Promise.resolve();
        flushSync();

        expect(theirs.read()['instance-key']).toBe(theirs.read()['instance-dot']);
        expect(shared(ours.read())).toEqual(theirs.read());
        expect(ours.read()['instance-key']).toBe('2:Felix;3:Garfield;');
    });

    test('follows the row when a key of it changes', () => {
        const ours = mounted(UnpackByKey);
        const theirs = mounted(UnpackByKeyNative);

        ours.click('rename');
        theirs.click('rename');

        expect(ours.read()['dict-key']).toBe('1:Thomas');
        expect(shared(ours.read())).toEqual(theirs.read());
    });

    // The key of a keyed block is computed outside the block, from the
    // pattern's names: the rows keep their nodes when the list turns.
    test('keys a block by an unpacked name, keeping each row its node', () => {
        const ours = mounted(UnpackByKey);
        const theirs = mounted(UnpackByKeyNative);
        const before = [ours.keyed(), theirs.keyed()];

        ours.click('turn');
        theirs.click('turn');

        expect(ours.keyed().map((one) => one.textContent)).toEqual(['Garfield', 'Felix']);
        expect(ours.keyed()).toEqual([...before[0]].reverse());
        expect(theirs.keyed()).toEqual([...before[1]].reverse());
    });

    test('takes a default only for a key the row does not have', () => {
        expect(mounted(UnpackByKey).read().default).toBe('4:anon');
    });

    test('and hands the keys it did not name back as a dict', () => {
        expect(mounted(UnpackByKey).read().rest).toBe("1:{'name': 'Tom'}");
    });

    // The dot raises on a name the row does not have, and so does the
    // unpacking, with the same sentence.
    test('raises on a misspelt key, as the dot does', () => {
        const target = document.body.appendChild(document.createElement('div'));

        expect(() => {
            mount(UnpackByKeyTypo, { target });
            flushSync();
        }).toThrow("AttributeError: 'dict' object has no attribute 'nmae'");
    });
});
