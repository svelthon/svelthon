// A field bound to `model.value` writes through the dot, and the dot decides
// between an attribute and a key. It decided by reading the attribute, which ran
// the property's getter before its setter: a getter that counts saw a read the
// assignment never makes, and one that refuses a read kept the setter from being
// reached at all. Svelte's own binding calls the setter alone, and so does a
// Python assignment.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import WriteSetter from './fixtures/WriteSetter.svelte';
import WriteSetterNative from './fixtures/WriteSetterNative.svelte';
import ForeignSetter from './fixtures/ForeignSetter.svelte';

// The same on a JavaScript object a parent hands over, whose property is an
// accessor of its own, inherited from its prototype, or answered by a proxy:
// the dot asked Brython for the attribute, which ran the getter. Each is
// measured against the assignment JavaScript itself makes, which is the one
// Svelte's binding makes.
const accessed = (shape) => {
    const log = { reads: 0, before: null, value: 'before', blocked: false };
    const accessor = {
        enumerable: true,
        configurable: true,
        get() {
            log.reads += 1;
            if (log.blocked) throw new Error('getter blocked, setter allowed');
            return log.value;
        },
        set(value) {
            log.before = log.reads;
            log.value = value;
            log.blocked = false;
        }
    };
    const own = () => Object.defineProperty({}, 'value', accessor);
    const model =
        shape === 'own'
            ? own()
            : shape === 'inherited'
              ? Object.create(own())
              : new Proxy(own(), {});

    return { log, model };
};

test.for([
    ['own', false],
    ['own', true],
    ['inherited', false],
    ['inherited', true],
    ['proxied', true]
])('a JavaScript accessor, %s, blocked %s: the setter alone, as JavaScript assigns', ([shape, blocked]) => {
    const witness = accessed(shape);
    witness.log.blocked = blocked;
    witness.model.value = 'after';

    const { log, model } = accessed(shape);
    const target = document.body.appendChild(document.createElement('div'));
    mount(ForeignSetter, { target, props: { model } });
    flushSync();
    Object.assign(log, { reads: 0, blocked });

    const field = target.querySelector('input');
    field.value = 'after';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    expect([log.before, log.value]).toEqual([witness.log.before, witness.log.value]);
    expect(log.before).toBe(0);
    target.remove();
});

const typed = (Component, block, props = {}) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props });

    flushSync();
    instance.reset(block);

    const field = target.querySelector('input');

    field.value = 'after';
    field.dispatchEvent(new Event('input', { bubbles: true }));

    const written = Array.from(instance.written());

    flushSync();

    return written;
};

test.each([
    ['Python', WriteSetter],
    ['native Svelte', WriteSetterNative]
])('%s: a typed value reaches the setter with no read before it', (_, Component) => {
    expect(typed(Component, false)).toEqual(['after', 0]);
});

test.each([
    ['Python', WriteSetter],
    ['native Svelte', WriteSetterNative]
])('%s: and a getter that refuses a read does not stop the write', (_, Component) => {
    expect(typed(Component, true)).toEqual(['after', 0]);
});

// A class with an attribute protocol of its own still declares the property:
// the declaration is asked first, and the protocol only for a name nothing
// declares.
test.each([['getattr'], ['getattribute']])('a class with its own %s: no read before the setter, none needed', (kind) => {
    expect(typed(WriteSetter, false, { kind })).toEqual(['after', 0]);
    expect(typed(WriteSetter, true, { kind })).toEqual(['after', 0]);
});

// The destination is still the one a read finds: an attribute held in the
// instance's own dictionary wins over a key of the same name.
test('a mapping with an attribute of a key\'s name is written where it is read', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(WriteSetter, { target });
    flushSync();

    const field = target.querySelector('[data-k="row"]');

    field.value = 'typed';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(target.querySelector('p').textContent).toBe('typed|key');
});

// And an attribute nothing declares, answered by `__getattr__`: the read finds
// it through the protocol, so the write asks the protocol too and lands on the
// attribute, not on the key beside it.
test('an attribute only __getattr__ answers is written where it is read', () => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(WriteSetter, { target });
    flushSync();

    const field = target.querySelector('input[data-k="virtual"]');

    field.value = 'typed';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(target.querySelector('p[data-k="virtual"]').textContent).toBe('typed|key');
});

// And a property of a key's name that raises `AttributeError` to say it holds
// none: the dot read the key, and wrote through the property's setter, so the
// key the field read on its next mount held the old text. Where the property
// holds one, the write is still its own; and beside rows read by index, whose
// `__getitem__` refuses a text, asked for a key first, the write failed.
test.for([
    ['fallback', 'typed|typed|None'],
    ['attribute', 'typed|from-map|typed'],
    ['indexed', 'typed|first']
])('an object with a property and a key is written where it is read: %s', ([key, expected]) => {
    const target = document.body.appendChild(document.createElement('div'));

    mount(WriteSetter, { target });
    flushSync();

    const field = target.querySelector(`input[data-k="${key}"]`);

    field.value = 'typed';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(target.querySelector(`p[data-k="${key}"]`).textContent).toBe(expected);
    target.remove();
});

// A name `__getattr__` answers for one read, beside a key of that name: read
// once, as the read reads it, the write is the attribute's. Asked twice, the
// second read missed it and the key was written.
test('a name __getattr__ answers once is read once and written as an attribute', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(WriteSetter, { target });

    flushSync();
    target.querySelector('button[data-k="once"]').click();
    flushSync();

    expect(Array.from(instance.once_state())).toEqual(['key', 'edited', 1]);
    target.remove();
});

// Until the property holds one: the write is the property's then, rendered in
// between or not. Told by the earlier read, the write written at once went to
// the key.
test.for([['flushed'], ['at once']])('a mapping whose property comes to hold one is written to it: %s', ([when]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(WriteSetter, { target });

    flushSync();
    instance.own_fallback('owned');
    if (when === 'flushed') flushSync();

    const field = target.querySelector('input[data-k="fallback"]');

    field.value = 'typed';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();

    expect(target.querySelector('p[data-k="fallback"]').textContent).toBe('typed|from-map|typed');
    target.remove();
});
