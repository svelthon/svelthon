// A prop the module writes has the setter Svelte holds it for, and one it never
// writes has none: the compiler has to see every write. A name bound by a
// statement that is no target, `def`, `class`, `import … as`, `except … as`,
// a capture of `match`, is written where it binds the name; the namespace's
// doors write nothing (`namespace-read-only.test.js`). A write past every rule
// raises, with the prop and the file.
import { test, expect } from 'vitest';
import { mount, flushSync, unmount } from './mounted.js';
import PropWrittenFormsParent from './fixtures/PropWrittenFormsParent.svelte';
import PropReadOnly from './fixtures/PropReadOnly.svelte';
import PropDefinedBy from './fixtures/PropDefinedBy.svelte';
import PropLocalsCountParent from './fixtures/PropLocalsCountParent.svelte';
import PropGlobalsCountParent from './fixtures/PropGlobalsCountParent.svelte';

test('every way of binding a module name writes the prop, as Python writes it', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(PropWrittenFormsParent, { target });
    const read = (k) => target.querySelector(`[data-k="${k}"]`).textContent.split(' ');

    flushSync();

    const module = read('m');

    instance.edit();
    flushSync();

    // `except … as` deletes the name as its block ends, as CPython does.
    expect([module, read('f')]).toEqual([
        ['written', 'written', 'written', 'written', 'unbound', 'written', 'written', 'written'],
        ['written', 'written', 'written', 'unbound']
    ]);

    await unmount(instance);
    target.remove();
});

// A default, a lambda's default and a decorator's argument run where the
// function is defined, as Python runs them: a `:=` there writes the module's
// prop, where it raised read-only. And a prop named `constructor` or
// `toString` with a default computed compiles, where the compiler wrote
// Object's source into it; given no value, Svelte itself reads Object's member
// under such a name, so only the values a parent gives are compared.
test('what a definition evaluates writes the prop where it is defined, and a prop may be named as an Object member', async () => {
    const shown = [];

    for (const props of [{}, { label: 'parent', other: 'parent', third: 'parent', constructor: 'given', toString: 'given', valueOf: 'given' }]) {
        const target = document.body.appendChild(document.createElement('div'));
        const instance = mount(PropDefinedBy, { target, props });

        flushSync();
        shown.push(target.querySelector('p').textContent);
        await unmount(instance);
        target.remove();
    }

    expect([shown[0].split('|').slice(0, 5).join('|'), shown[1]]).toEqual([
        'prepared|prepared|lambda|lambda|decorated',
        'prepared|prepared|lambda|lambda|decorated|given|given|given'
    ]);
});

// `locals()` in a function is its own names: counting them writes no prop, so
// a label the parent reads off a plain object is read again at each render, as
// Svelte reads it, where the child kept the first one.
// And neither does the module's own namespace, counted or handed on: it reads
// and never writes, where the compiler took a `globals()` it saw for a write
// of every prop, and the label stayed the first one.
test.for([
    ["a function's locals()", PropLocalsCountParent],
    ["the module's globals(), counted or handed on", PropGlobalsCountParent]
])('%s writes no prop of the module', async ([, Parent]) => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(Parent, { target });
    const shown = [];

    flushSync();
    for (const label of ['B', 'C']) {
        instance.change(label);
        flushSync();
        shown.push(target.querySelector('p').textContent);
    }

    expect(shown).toEqual(['1|B', '2|C']);

    await unmount(instance);
    target.remove();
});

// A door of the namespace no rule of the compiler names, `__getattribute__`,
// writes nothing either: refused at run time, with the name, the file and the
// line, and the props keep what the parent gave.
test('a write no rule of the compiler sees raises, with the name, the file and the line', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const instance = mount(PropReadOnly, { target, props: { ticket: 'parent' } });
    const raised = (call) => {
        try {
            call();
        } catch (error) {
            return String(error.message);
        }
    };

    flushSync();

    const [ticket, count] = [raised(() => instance.edit()), raised(() => instance.edit_default())];

    expect(ticket).toContain("TypeError: svelthon — a module's namespace is read-only through globals()");
    expect(ticket).toContain('`ticket` is bound by assigning it');
    expect(ticket).toContain('tests/fixtures/PropReadOnly.svelte:10');
    expect(count).toContain('`count` is bound by assigning it');

    flushSync();
    expect(target.querySelector('p').textContent).toBe('parent|3');

    await unmount(instance);
    target.remove();
});
