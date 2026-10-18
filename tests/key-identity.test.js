// Svelte compares a key with `===`. A list, a dict, a set or an instance is the
// same object while it lives, so it keys by identity, as it does in JavaScript;
// only a value rebuilt on every computation (a tuple, a float) keys by value,
// which `tests/keys.test.js` holds.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import * as ownEquality from './fixtures/own_equality_keys.py';
import KeyIdentity from './fixtures/KeyIdentity.svelte';
import NumericKey from './fixtures/NumericKey.svelte';
import BigintKey from './fixtures/BigintKey.svelte';
import NanKey from './fixtures/NanKey.svelte';
import SignedZeroKey from './fixtures/SignedZeroKey.svelte';
import FunctionKey from './fixtures/FunctionKey.svelte';
import BoundMethodKey from './fixtures/BoundMethodKey.svelte';
import NoneNullKey from './fixtures/NoneNullKey.svelte';
import { __pybridge } from '../src/lib/bridge.js';

// None and `javascript.NULL` are two keys, as Python finds them unequal, alone
// or inside a tuple: the text a tuple keys by spelled both `None`, so a context
// set under one was found under the other, a keyed `{#each}` refused the two
// rows as `each_key_duplicate`, and a `{#key}` kept its block.
test.for([['scalar'], ['tuple'], ['nested']])('%s: None and javascript.NULL are two keys, as Python finds them unequal', ([kind]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(NoneNullKey, { target, props: { kind } });
    flushSync();

    expect(instance.model()).toEqual([false, [0, 1]]);
    expect([...target.querySelectorAll('output')].map((one) => one.textContent)).toEqual(['0', '1']);

    const field = target.querySelector('input');

    instance.change();
    flushSync();
    expect(target.querySelector('input')).not.toBe(field);
});

test.for([['alone'], ['tuple'], ['builtin'], ['special'], ['special in a tuple']])('%s: an equal bound method keeps the block, another makes one', ([kind]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BoundMethodKey, { target, props: { kind } });
    flushSync();
    expect(instance.equal_again()).toBe(true);
    const field = target.querySelector('input');
    field.value = 'unsaved';

    instance.reread();
    flushSync();
    expect(target.querySelector('input')).toBe(field);

    instance.change();
    flushSync();
    expect(target.querySelector('input')).not.toBe(field);
});

// A function in a tuple or a frozenset key is equal to itself alone: two built
// by one factory print alike and are two keys.
test.for([['tuple'], ['frozenset']])('%s: a new function makes a new block, the same one keeps it', ([kind]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(FunctionKey, { target, props: { kind } });
    flushSync();
    const field = target.querySelector('input');
    field.value = 'unsaved';

    instance.rewrap();
    flushSync();
    expect(target.querySelector('input')).toBe(field);

    instance.renew();
    flushSync();
    expect(target.querySelector('input')).not.toBe(field);
    expect(target.querySelector('input').value).toBe('draft');
});

const setup = () => {
    const target = document.body.appendChild(document.createElement('div'));
    mount(KeyIdentity, { target });
    flushSync();
    return {
        at: (key) => target.querySelector(`[data-k="${key}"]`),
        press: (key) => {
            target.querySelector(`button[data-k="${key}"]`).click();
            flushSync();
        }
    };
};

test('two equal rows keyed by themselves are two rows', () => {
    expect(setup().at('todos').textContent).toBe('todotodo');
});

// A key made from a repr() is not the string that spells it.
test('a value keyed by repr() and its spelling are two keys', () => {
    expect(setup().at('mixed').textContent).toBe('floatstrtuplestrbytesstr');
});

test('two NaN are two keys', () => {
    expect(setup().at('nans').textContent).toBe('nannan');
});

// A tuple whose class defines its own `__eq__` or `__hash__` keys by identity,
// as an instance does, alone or inside a tuple: its stored members say nothing
// of what that class calls equal. Two `Distinct((1,))`, unequal to Python,
// were one key, a context written twice and an `{#each}` refusing them as
// duplicates. A class that only prints its own way keeps the tuple's equality,
// and its value.
test('a tuple or a float whose class defines its equality keys by identity', () => {
    // The Python list's own members, which a view would hand over as views
    // and numbers.
    const members = (rows) => Array.from(globalThis.__BRYTHON__.PYOBJ_MAP.get(rows));
    const keys = (rows) => members(rows).map((one) => __pybridge.key(one));

    const [first, second] = keys(ownEquality.distinct);
    expect(first).not.toBe(second);
    expect(__pybridge.key(members(ownEquality.distinct)[0])).toBe(first);

    const [one, two] = keys(ownEquality.joined);
    expect(one).not.toBe(two);

    const [a, b] = keys(ownEquality.spelled);
    expect(a).toBe(b);

    const [outer, other, again] = keys(ownEquality.nested);
    expect(outer).not.toBe(other);
    expect(outer).toBe(again);

    // A number's class too, which a key otherwise reads as the number.
    const [half, otherHalf] = keys(ownEquality.exact);
    expect(half).not.toBe(otherHalf);
});

// A tuple keys by what makes it equal, its members: an instance in it by
// identity, however it prints, and scalars and frozensets by value.
test('two tuples whose members print alike are two keys', () => {
    expect(setup().at('boxes').textContent).toBe('12');
});

test('and a tuple keys by its members, not by an __iter__ it redefines', () => {
    expect(setup().at('masked').textContent).toBe('12');
});

test('and a float keys by its value, not by a __repr__ its class redefines', () => {
    expect(setup().at('scores').textContent).toBe('1.52.5');
});

test('and tuples of values still key by value', () => {
    expect(setup().at('spelled').textContent).toBe('ab');
});

test('a list mutated keeps its {#key} block', () => {
    const { at, press } = setup();
    const before = at('block');
    press('grow');
    expect(at('block')).toBe(before);
    expect(at('block').textContent).toBe('2');
});

test('a list replaced by an equal one re-creates it', () => {
    const { at, press } = setup();
    const before = at('block');
    press('replace');
    expect(at('block')).not.toBe(before);
});

test('a field in a row keyed by itself survives a keystroke', () => {
    const { at } = setup();
    const field = at('field');
    field.value = 'Ada L';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    expect(at('field')).toBe(field);
});

// Keys are equal as Python finds numbers equal: `1 == 1.0 == True`, `0 ==
// -0.0`, alone or in a tuple. A key replaced by an equal one keeps its block,
// and the field in it keeps what was typed; a different one makes a new block.
describe('a numeric key follows Python equality', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(NumericKey, { target });
        flushSync();
        const at = (key) => target.querySelector(`[data-k="${key}"]`);
        const typed = () => {
            for (const key of ['tuple', 'number']) at(key).value = 'unsaved';
            return [at('tuple'), at('number')];
        };
        const press = (key) => {
            at(key).click();
            flushSync();
        };
        return { at, typed, press };
    };

    test.for([['float'], ['bool'], ['zero', 'at-zero']])('%s: an equal key keeps the field', ([button, start]) => {
        const { at, typed, press } = setup();
        if (start) press(start);
        const [tuple, number] = typed();

        press(button);

        expect(at('tuple')).toBe(tuple);
        expect(at('number')).toBe(number);
        expect(at('tuple').value).toBe('unsaved');
    });

    test('and a different one makes a new field', () => {
        const { at, typed, press } = setup();
        const [tuple, number] = typed();

        press('other');

        expect(at('tuple')).not.toBe(tuple);
        expect(at('number')).not.toBe(number);
    });
});

// And an int that arrives as a BigInt is the int it equals. A key was a Number
// up to 2 ** 53 and a BigInt kept as it came, so `1` and `1n`, equal in Python,
// were two keys: the field was rebuilt and the context not found. Past 2 ** 53
// both were BigInts already.
test.for([
    [1, 1n],
    [0, 0n],
    [-1, -1n],
    [Number.MAX_SAFE_INTEGER, BigInt(Number.MAX_SAFE_INTEGER)],
    [2n ** 53n, 2n ** 53n]
])('%s and the BigInt %s are one key, as Python finds them equal', ([start, incoming]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BigintKey, { target, props: { start, incoming } });
    flushSync();
    const field = target.querySelector('input');
    field.value = 'unsaved';

    expect(instance.equal()).toBe(true);
    instance.change();
    flushSync();

    expect(target.querySelector('input')).toBe(field);
    expect(field.value).toBe('unsaved');
    expect(target.querySelector('p').textContent).toBe('kept');
});

// A complex is equal to another when both parts are, as numbers: the sign of a
// zero part does not make another key, alone, in a tuple, in a frozenset, or
// as a context key.
test.for([['complex'], ['tuple'], ['frozenset']])('%s: a signed zero part keeps the block and finds the context', ([kind]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(SignedZeroKey, { target, props: { kind } });
    flushSync();
    const field = target.querySelector('input');
    field.value = 'unsaved';

    instance.flip();
    flushSync();
    expect(target.querySelector('input')).toBe(field);
    expect(target.querySelector('[data-k="found"]').textContent).toBe('retained');
});

// A NaN equals nothing, and neither does a complex with a NaN part, alone or in
// a tuple or a frozenset: a new one is a new key, and the same object put back
// is its own key still.
describe('a key holding a NaN', () => {
    const setup = (kind) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(NanKey, { target, props: { kind } });
        flushSync();
        const field = target.querySelector('input');
        field.value = 'unsaved';
        return { instance, field, now: () => target.querySelector('input') };
    };

    test.for([['float'], ['complex_real'], ['complex_imag'], ['complex_zero'], ['subclass'], ['tuple'], ['frozenset']])(
        '%s: replaced by a new one, makes a new block; put back, keeps its own',
        ([kind]) => {
            const { instance, field, now } = setup(kind);
            expect(instance.same_as_fresh()).toBe(false);

            instance.put_back();
            flushSync();
            expect(now()).toBe(field);

            instance.replace();
            flushSync();
            expect(now()).not.toBe(field);
            expect(now().value).toBe('draft');
        }
    );

    test('a finite complex replaced by an equal one keeps its block', () => {
        const { instance, field, now } = setup('finite');
        expect(instance.same_as_fresh()).toBe(true);

        instance.replace();
        flushSync();
        expect(now()).toBe(field);
        expect(now().value).toBe('unsaved');
    });
});

// A JavaScript symbol in a tuple key is equal to itself alone, as the symbol
// alone keys by itself: two made with one description print alike, and keyed
// by that text they were one row of an `{#each}`, one `{#key}` block and one
// context. One symbol is one key however often its tuple is rebuilt, and
// `Symbol.for` gives back the one it registered.
test('a symbol in a tuple key is itself alone', () => {
    const $B = globalThis.__BRYTHON__;
    const key = (...items) => __pybridge.key($B.fast_tuple(items));
    const first = Symbol('row');
    const second = Symbol('row');

    expect(key(first)).not.toBe(key(second));
    expect(key(Symbol())).not.toBe(key(Symbol()));
    expect(key(first)).toBe(key(first));
    expect(key($B.fast_tuple([first]))).not.toBe(key($B.fast_tuple([second])));
    expect(key(Symbol.for('row'))).toBe(key(Symbol.for('row')));
    expect(key(Symbol.for('row'))).not.toBe(key(first));
    expect(key(first)).not.toBe(key('Symbol(row)'));
});
