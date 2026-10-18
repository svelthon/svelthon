// **A change inside a row reaches what reads that row, and nothing else**, as in
// Svelte, whose block walks the list's own entries and whose rows are each a
// proxy of their own. Through the name, the block read every row with
// everything under it, so a write in one row ran the block again over all of
// them and every row's reads with it, and a thousand bound selects whose model
// Svelte writes as it mounts made a million.
//
// Counted rather than timed: the key of a keyed block runs for every row at each
// run of the block, which makes those runs visible, and the witness is the same
// markup in Svelte. Svelthon reads one key more per row a change was made in,
// to tell whether it moved (`__pybridge.walk`), where Svelte's key reads
// the one field it names.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { seen, reset } from './fixtures/counting.js';
import EachRowWrite from './fixtures/EachRowWrite.svelte';
import EachRowWriteNative from './fixtures/EachRowWriteNative.svelte';
import EachRowPairs from './fixtures/EachRowPairs.svelte';
import EachRowPairsNative from './fixtures/EachRowPairsNative.svelte';
import EachRowRekey from './fixtures/EachRowRekey.svelte';
import EachRowRekeyNative from './fixtures/EachRowRekeyNative.svelte';
import EachRowTuple from './fixtures/EachRowTuple.svelte';
import EachRowTupleNative from './fixtures/EachRowTupleNative.svelte';
import EachFreshTuple from './fixtures/EachFreshTuple.svelte';
import EachFreshTupleNative from './fixtures/EachFreshTupleNative.svelte';
import EachMadePairs from './fixtures/EachMadePairs.svelte';
import EachMadePairsNative from './fixtures/EachMadePairsNative.svelte';
import EachPairIdentity from './fixtures/EachPairIdentity.svelte';
import EachPairIdentityNative from './fixtures/EachPairIdentityNative.svelte';

// What a component counted and showed after mounting and after each action.
const steps = (Component, props, ...actions) => {
    const target = document.body.appendChild(document.createElement('div'));
    const shown = () => [...target.querySelectorAll('span')].map((one) => one.textContent).join(' ');

    reset();
    mount(Component, { target, props });
    flushSync();

    const counts = [{ ...seen, shown: shown() }];

    for (const action of actions) {
        action(target);
        flushSync();
        counts.push({ ...seen, shown: shown() });
    }

    return counts;
};

// Svelte's counts, with one key more for each row changed up to each step.
const plus = (counts, ...changed) => counts.map((one, at) => ({ ...one, keys: one.keys + changed[at] }));

const choose = (target) => {
    const select = target.querySelectorAll('select')[1];

    select.selectedIndex = 2;
    select.dispatchEvent(new Event('change'));
};

test('selects written as they mount, then one chosen, run what Svelte runs', () => {
    const mine = steps(EachRowWrite, { n: 50 }, choose);

    expect(mine).toEqual(plus(steps(EachRowWriteNative, { n: 50 }, choose), 50, 51));
    expect(mine[1].shown).toMatch(/^0 2 0 /);
});

// And one key more per pair made anew at each walk, read off each of them,
// which tells a key read off the pair itself, `id(pair)`, from one read off its
// members, the cases below.
test('rows walked through enumerate() run their block again on a change of the list alone', () => {
    const click = (name) => (target) => target.querySelector(`.${name}`).click();
    const mine = steps(EachRowPairs, {}, click('bump'), click('grow'));

    expect(mine).toEqual(plus(steps(EachRowPairsNative, {}, click('bump'), click('grow')), 0, 7, 7));
    expect(mine.map(({ shown }) => shown)).toEqual([
        '0:0 1:0 2:0 3:0 4:0',
        '0:0 1:0 2:1 3:0 4:0',
        '0:0 1:0 2:1 3:0 4:0 5:9'
    ]);
});

// The pairs `.items()` and `enumerate()` make are theirs wherever they go: in
// a list of the expression's own, `sorted(d.items())`, a change inside one row
// read every row again, where Svelte reads the one that changed.
test.for([['sorted'], ['enumerated'], ['reversed']])('pairs made by the iterable and handed on, %s, read what Svelte reads', ([kind]) => {
    const grow = (target) => target.querySelector('.grow').click();
    const mine = steps(EachMadePairs, { kind }, grow);

    expect(mine).toEqual(steps(EachMadePairsNative, { kind }, grow));
    expect(mine[1].rows - mine[0].rows).toBe(1);
});

// Whether each input is a new one after each of two walks, and its text: typed
// into before each walk.
const walks = (Component, props) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });
    const inputs = () => [...target.querySelectorAll('input')];
    const walked = [];

    flushSync();

    for (let round = 0; round < 2; round++) {
        const before = inputs();

        before.forEach((one, at) => (one.value = `draft-${at}`));
        instance.step();
        flushSync();
        walked.push(inputs().map((one, at) => [one !== before[at], one.value]));
    }

    target.remove();
    return walked;
};

// Pairs `enumerate()`, `zip()` and `.items()` made anew, the same rows in
// them, stood for the old ones even under a key read off the pair itself,
// `id(pair)`: the block kept its old rows, and an input typed into kept its
// text. Svelte, handed new pairs keyed by themselves, makes new rows, twice.
test.for([['enumerate'], ['zip'], ['items']])('pairs made anew under a key read off the pair, %s, are new rows, as in Svelte', ([kind]) => {
    expect(walks(EachPairIdentity, { kind })).toEqual(walks(EachPairIdentityNative, {}));
    expect(walks(EachPairIdentity, { kind })[0]).toEqual([
        [true, ''],
        [true, '']
    ]);
});

// And under a key read off the members for the first row and off the pair for
// the others: the first row asked alone stood for them all, its key the same,
// and the others kept their old rows.
test.for([['enumerate'], ['zip'], ['items']])('pairs made anew under a key read off the pair for some rows, %s, are new rows there, as in Svelte', ([kind]) => {
    expect(walks(EachPairIdentity, { kind, keying: 'mixed' })).toEqual(walks(EachPairIdentityNative, { keying: 'mixed' }));
    expect(walks(EachPairIdentity, { kind, keying: 'mixed' })[0]).toEqual([
        [false, 'draft-0'],
        [true, '']
    ]);
});

// The other half: a key changed in place is a new row to Svelte, made again,
// though no change of the list ran the block.
test('a key changed inside its row makes that row again, as in Svelte', () => {
    const kept = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target });
        flushSync();

        const before = [...target.querySelectorAll('span')];

        target.querySelector('button').click();
        flushSync();

        const after = [...target.querySelectorAll('span')];

        return after.map((one, at) => [one.textContent, one === before[at]]);
    };

    expect(kept(EachRowRekey)).toEqual(kept(EachRowRekeyNative));
    expect(kept(EachRowRekey)).toEqual([
        ['0', true],
        ['1', false],
        ['2', true]
    ]);
});

// The pairs `enumerate()` makes anew at each walk are the same rows when they
// hold the same ones; a tuple of the author's put in place of an equal one is
// not. Taken for the same, the block kept the old tuple: its key, and what its
// row read, `id(row)`, stayed the old one's.
//
// Nor is a tuple the iterable makes at each call, `[(row,)]`, which nobody
// watches and which holds a watched row: the shape of a pair `enumerate()`
// makes, and taken for one, so the block keyed by `id(pair)` kept its node and
// what was typed in it. A pair is told by where it came from; `enumerate()`'s,
// keyed by position, still keeps its node, as Svelte's keeps a row keyed so.
test('a tuple put in place of an equal one, or made at each call, is a new row, under any key', () => {
    const replaced = (Component, keying) => {
        const target = document.body.appendChild(document.createElement('div'));

        mount(Component, { target, props: { keying } });
        flushSync();

        const before = target.querySelector('span');

        target.querySelector('button').click();
        flushSync();

        const after = target.querySelector('span');

        return { shown: after.textContent === target.querySelector('output').textContent, kept: after === before };
    };

    for (const keying of ['identity', 'value', 'none']) {
        expect(replaced(EachRowTuple, keying), keying).toEqual(replaced(EachRowTupleNative, keying));
    }

    expect(replaced(EachRowTuple, 'identity')).toEqual({ shown: true, kept: false });

    const kept = (Component) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(Component, { target });

        flushSync();

        const inputs = () => ['made', 'paired'].map((key) => target.querySelector(`[data-k="${key}"] input`));
        const before = inputs();

        before.forEach((one) => (one.value = 'unsaved'));
        instance.advance();
        flushSync();

        return inputs().map((one, at) => [one === before[at], one.value]);
    };

    expect(kept(EachFreshTuple)).toEqual(kept(EachFreshTupleNative));
    expect(kept(EachFreshTuple)).toEqual([
        [false, 'draft'],
        [true, 'unsaved']
    ]);
});
