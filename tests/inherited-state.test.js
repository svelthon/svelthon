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
import BasesChange from './fixtures/BasesChange.svelte';
import SpecialMethodSwap from './fixtures/SpecialMethodSwap.svelte';
import SpecialMethodSwapNative from './fixtures/SpecialMethodSwapNative.svelte';
import RebasedMethod from './fixtures/RebasedMethod.svelte';
import RebasedMethodNative from './fixtures/RebasedMethodNative.svelte';
import ClassLeft from './fixtures/ClassLeft.svelte';
import ClassLeftNative from './fixtures/ClassLeftNative.svelte';
import { runs } from './fixtures/class_runs.js';
import MetaClassRead from './fixtures/MetaClassRead.svelte';
import MetaClassReadNative from './fixtures/MetaClassReadNative.svelte';

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

// New bases, `C.__bases__ = (B,)`, are a new lookup for every name read
// through the class: the page kept `A`'s value while the model read `B`'s, and
// `issubclass`, `isinstance` and `super()`, which read the order with no name
// along it, kept the old answer. The values are CPython's.
test.for([
    ['class', '0', '1'],
    ['subclass', '0', '1'],
    ['instance made in the expression', '0', '1'],
    ['super()', '0', '1'],
    ['issubclass', 'False', 'True'],
    ['isinstance', 'False', 'True'],
    ['mro', 'C,A,object', 'C,B,object']
])('a read through a class given new bases repaints: %s', ([kind, before, after]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(BasesChange, { target, props: { kind } });

    flushSync();
    expect(target.querySelector('output').textContent).toBe(before);

    instance.change();
    flushSync();

    expect(instance.model()).toBe(after);
    expect(target.querySelector('output').textContent).toBe(after);
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

// A special method given anew, `Base.__len__ = …`, changes what an operation
// answers for an instance of the class or of a subclass, `len(one)`, `one()`,
// a walk of it or a name its `__getattr__` answers, and none of them reads the
// method by its name: the model answered 99 and the page kept 1. The witness
// is the same reads of a class that answers from Svelte's state.
const swapped = (Component, kind, subclassed) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind, subclassed } });
    flushSync();

    const before = target.querySelector('output').textContent;

    flushSync(() => instance.change());

    return { shown: [before, target.querySelector('output').textContent], model: instance.model() };
};

test.for(['len', 'call', 'iter', 'getattr'].flatMap((kind) => [false, true].map((subclassed) => [kind, subclassed])))(
    'a new __%s__ on the class repaints what an instance answers, of a subclass %s',
    ([kind, subclassed]) => {
        const mine = swapped(SpecialMethodSwap, kind, subclassed);

        expect(mine).toEqual(swapped(SpecialMethodSwapNative, kind, subclassed));
        expect(mine).toEqual({ shown: ['1', '99'], model: 99 });
    }
);

// And after new bases: `Holder.__bases__ = (Second,)` repainted 2, and a
// `__len__` given to `Second` afterwards left the page at 2, the object being
// known to the classes it was looked up through when it came under watch.
const rebased = (Component, subclassed) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { subclassed } });
    const shown = () => target.querySelector('output').textContent;
    flushSync();

    const first = shown();

    flushSync(() => instance.migrate());

    const second = shown();

    flushSync(() => instance.change());

    return { shown: [first, second, shown()], model: instance.model() };
};

test.for([false, true])('a method given to a new base repaints what an object answers, of a subclass %s', (subclassed) => {
    const mine = rebased(RebasedMethod, subclassed);

    expect(mine).toEqual(rebased(RebasedMethodNative, subclassed));
    expect(mine).toEqual({ shown: ['1', '2', '99'], model: 99 });
});

// And a class it left, by new bases or by a new `__class__`, wakes it no more:
// an effect that read the object and wrote the class it had left ran again at
// each write, four times here where a guard stops it, a thousand and one
// without one, until Svelte gave up. A method its new class is given later
// still reaches it.
const left = (Component, how) => {
    const target = document.body.appendChild(document.createElement('div'));

    runs.length = 0;

    const instance = mount(Component, { target, props: { how } });
    flushSync();

    const first = target.querySelector('output').textContent;

    flushSync(() => instance.change());

    return { shown: [first, target.querySelector('output').textContent], runs: [...runs] };
};

test.for(['bases', 'class'])('an object that left a class by its %s is not woken by that class', (how) => {
    const mine = left(ClassLeft, how);

    expect(mine).toEqual(left(ClassLeftNative, how));
    expect(mine).toEqual({ shown: ['2', '99'], runs: [2, 99] });
});

// A class read directly for a special method its metaclass gives it, the
// metaclass being the author's: `len(Subject)` after `Meta.__len__ = …`. One
// the script declares by `class` binds no state, and the page kept 1 where the
// model answered 99; its read now follows its metaclass's special methods, and
// nothing else of it. One imported binds as `=` does, and one a function of a
// reactive module reads is read through that module's names, the same way.
const metaRead = (Component, kind) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Component, { target, props: { kind } });
    flushSync();

    const before = target.querySelector('output').textContent;

    flushSync(() => instance.change());

    return { shown: [before, target.querySelector('output').textContent], model: instance.model() };
};

test.for(['declared', 'imported', 'module function'])(
    'a class read %s for a special method follows its metaclass given a new one',
    (kind) => {
        const mine = metaRead(MetaClassRead, kind);

        expect(mine).toEqual(metaRead(MetaClassReadNative, kind));
        expect(mine).toEqual({ shown: ['1', '99'], model: 99 });
    }
);
