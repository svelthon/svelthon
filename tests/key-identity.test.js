// Svelte compares a key with `===`. A list, a dict, a set or an instance is the
// same object while it lives, so it keys by identity, as it does in JavaScript;
// only a value rebuilt on every computation (a tuple, a float) keys by value,
// which `tests/keys.test.js` holds.
import { test, expect, describe } from 'vitest';
import { mount, flushSync } from './mounted.js';
import KeyIdentity from './fixtures/KeyIdentity.svelte';
import NumericKey from './fixtures/NumericKey.svelte';
import NanKey from './fixtures/NanKey.svelte';

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
