// **`delete` from JavaScript is Python's `delattr`**, on the view of an
// instance as on the instance in Python: a property's deleter runs, a
// descriptor's `__delete__`, the deleter a subclass inherits, and what one
// raises is raised. The view deleted only what the instance's `__dict__` and
// slots held, so a deleter, kept by the class, never ran, and the deletion
// said it had. The witness is `del box.value` run by Python on a twin, the
// state and the answer compared.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import { fresh, erase, describe } from './fixtures/deleted_attributes.py';
import DeletedAttribute from './fixtures/DeletedAttribute.svelte';

const python = (kind) => {
    const box = fresh(kind);

    return [erase(box), describe(box)];
};

const javascript = (kind) => {
    const box = fresh(kind);
    let status = 'ok';

    try {
        delete box.value;
    } catch (error) {
        status = /ValueError|AttributeError/.exec(String(error?.message ?? error))?.[0] ?? String(error);
    }

    return [status, describe(box)];
};

test.for(['property', 'descriptor', 'inherited', 'raising', 'readonly', 'own'])('deleting %s from JavaScript is deleting it in Python', (kind) => {
    expect(javascript(kind)).toEqual(python(kind));
});

// A name the class holds as plain data, or nobody holds, is left as
// JavaScript leaves a property it does not own: true, and nothing changed.
test("deleting a class's attribute or an absent one from JavaScript changes nothing", () => {
    const box = fresh('class');

    expect(javascript('class')).toEqual(['ok', '[7, []]']);
    expect(Reflect.deleteProperty(box, 'absent')).toBe(true);
    expect(describe(box)).toBe('[7, []]');
});

test.for(['property', 'descriptor', 'inherited'])('an instance whose %s JavaScript deletes repaints its component', (kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(DeletedAttribute, { target, props: { kind } });

    flushSync();
    delete instance.expose().value;
    flushSync();

    expect(target.querySelector('output').textContent).toBe("[None, ['delete:value']]");
    target.remove();
});
