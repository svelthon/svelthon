// A class attribute written on the class that holds it repaints what reads it
// through an instance, a subclass, or an instance of that class, and so does
// one a class between creates, shadowing it, replaces or deletes. Only the
// class itself was watched: `Base.count += 1` moved the model to `1|0` and left
// the page at `0|0`; then only the class holding it, and `Middle.count = 9`
// left it at `0|0` again. Appending to a list already read worked, the list
// being watched on its own, and an attribute of the instance's own masks the
// class's as in Python.
import { test, expect } from 'vitest';
import { mount, flushSync } from './mounted.js';
import InheritedState from './fixtures/InheritedState.svelte';
import DescriptorState from './fixtures/DescriptorState.svelte';
import ClassSettingsBind from './fixtures/ClassSettingsBind.svelte';

// A property or a method is looked up through the classes as a constant is, and
// replacing it on one of them, or shadowing it from one between, changes what
// the instance reads. Their classes were not linked under the instance, so the
// model answered 1 and the page showed 0 until something else repainted it.
// Read before anything else invalidates: a page repainted by another write
// would hide a read that was never rerun.
// Every way Python writes or deletes a name: the statement, the builtin, and
// the type's own method called by name. And a name read absent, which a class
// gains later: `getattr(holder, "extra", 0)` turns 1.
test.for([
    'data',
    'property',
    'property to data',
    'method',
    'shadowing property',
    'shadowing method',
    'shadow deleted',
    'shadow deleted by delattr()',
    'shadow deleted by type.__delattr__',
    'property set by type.__setattr__',
    'instance attribute deleted by delattr()',
    'name a class gains',
    'property a class gains',
    'method a class gains',
    // Read on the class itself, `Base.method(holder)`: the class is bound by
    // `class`, nothing watched it, and the page kept the old answer while the
    // model gave the new one.
    'method read on its class',
    'method read on a subclass',
    'data read on its class',
    // Read through `super()`, which looks on the classes after its own: the
    // `super` object is neither the class nor the instance, and nothing
    // followed the name on them.
    'data read through super()',
    'property read through super()',
    'method read through super()',
    'name a class gains, read through super()',
    'data read through super() of a class',
    // Read on a class, found on its metaclass, which its MRO does not hold.
    'data of its metaclass',
    'property of its metaclass',
    'method of its metaclass',
    'name its metaclass gains'
])(
    'a %s replaced on a class repaints what reads it through an instance',
    (kind) => {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(DescriptorState, { target, props: { kind } });

        flushSync();
        expect(target.querySelector('output').textContent).toBe('0');

        instance.change();
        flushSync();

        expect(instance.model()).toBe(1);
        expect(target.querySelector('output').textContent).toBe('1');
    }
);

// And written by a binding: its write half runs as a template expression does,
// and the wake-up by name, quiet while the template renders, was quiet for it
// too, so a class bound by `class` kept `light` on the page where the model held
// `dark`. A class bound by `=` repainted, woken through its mark.
test.for(['class', 'assigned'])('a class attribute a field is bound to repaints, bound by %s', (way) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(ClassSettingsBind, { target, props: { way } });

    flushSync();
    const input = target.querySelector('input');
    input.value = 'dark';
    input.dispatchEvent(new Event('input'));
    flushSync();

    expect(instance.model()).toBe('dark');
    expect(target.querySelector('p').textContent).toBe('dark');
});

const shown = (kind, steps) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(InheritedState, { target, props: { kind } });
    const pages = [];

    flushSync();
    for (const how of steps) {
        instance.change(how);
        flushSync();
        pages.push([target.querySelector('p').textContent, instance.held()]);
    }

    return pages;
};

test.for(
    ['instance', 'subclass', 'own class'].flatMap((kind) =>
        ['augmented', 'rebound', 'append', 'masked'].map((how) => [kind, how])
    )
)('read through %s, a write on the base, %s, repaints', ([kind, how]) => {
    const [[page, model]] = shown(kind, [how]);

    expect(page).not.toBe('0|0');
    expect(page).toBe(model);
});

test.for(
    ['instance', 'subclass'].flatMap((kind) =>
        ['shadowed', 'shadowed rows', 'shadowed below'].map((how) => [kind, how])
    )
)('read through %s, a class between, %s, repaints', ([kind, how]) => {
    const [[page, model]] = shown(kind, [how]);

    expect(page).not.toBe('0|0');
    expect(page).toBe(model);
});

test.for(['instance', 'subclass'])('read through %s, a shadow made, replaced and deleted, repaints each time', (kind) => {
    expect(shown(kind, ['shadowed', 'shadowed', 'unshadowed'])).toEqual([
        ['9|0', '9|0'],
        ['9|0', '9|0'],
        ['0|0', '0|0']
    ]);
});
