import { test, expect, describe } from 'vitest';
import { mount, flushSync, settled } from './mounted.js';
import { directiveModules } from '../src/lib/markup.js';
import { pyModule } from '../src/lib/runtime.js';
import DirectiveModule from './fixtures/DirectiveModule.svelte';

const { compile } = await import('../src/lib/compile.cjs').then((m) => m.default ?? m);

// A directive's *value* has been Python for a long time. Its *name* had not:
// Svelte copies that text into a `() => …` of its own, so `in:fades.typewriter`
// looks for a JavaScript `fades`, and `import fades` binds in Python's namespace
// instead. Nothing said so — an intro transition is skipped on first render, so
// the element mounted, the text appeared whole, and the lesson never ran.
describe('the head of a dotted directive', () => {
    test('is found for each directive that names a function', () => {
        expect(directiveModules('<p use:a.act in:b.fade out:c.fade transition:d.fade>x</p>')).toEqual(
            ['a', 'b', 'c', 'd']
        );
    });

    test('and inside a keyed block, where animate: belongs', () => {
        expect(directiveModules('{#each xs as x (x)}<p animate:moves.flip>x</p>{/each}')).toEqual([
            'moves'
        ]);
    });

    // `class:` names a class, `style:` a property, `bind:` a target. A dot means
    // something else in all three, and seeding a binding for it would be noise
    // at best.
    test('but not of the directives that name something else', () => {
        expect(directiveModules('<p class:a.b style:c.d bind:e.f>x</p>')).toEqual([]);
    });

    test('nor of an undotted one, which resolves on its own', () => {
        expect(directiveModules('<p transition:fly use:mark>x</p>')).toEqual([]);
    });

    test('and each head once, however many directives name it', () => {
        expect(directiveModules('<p in:a.one out:a.two use:a.three>x</p>')).toEqual(['a']);
    });
});

describe('the binding it needs', () => {
    const script = (src, pyDirectives) =>
        compile(src, 'Probe', 'src/Probe.svelte', { pyDirectives }).script;

    test('is emitted for a module the file imports and a directive names', () => {
        expect(script('import fades\n', ['fades'])).toContain('const fades = __pyModule("fades");');
    });

    // Only what is actually broken. A name that resolves in JavaScript already
    // does so, and shadowing it would be a regression dressed as a fix.
    test('but not for a name no import declares', () => {
        expect(script('x = 1\n', ['fades'])).not.toContain('const fades = pyModule');
    });

    test('nor for one a JavaScript import already binds', () => {
        const src = 'importjs {fades} from "./fades.js"\n\nx = 1\n';

        expect(script(src, ['fades'])).not.toContain('const fades = pyModule');
    });
});

describe('a directive naming a module', () => {
    const setup = () => {
        const target = document.body.appendChild(document.createElement('div'));
        mount(DirectiveModule, { target });
        flushSync();
        return (k) => target.querySelector(`p[data-k="${k}"]`).textContent;
    };

    test('runs the action it names', () => expect(setup()('acted')).toBe('acted'));

    test('and runs it with a value too', () => expect(setup()('valued')).toBe('acted'));

    // An `async def` is started, as a handler's is, not flattened into an
    // empty object Svelte then ignores.
    test('and runs an action written as a coroutine', async () => {
        const at = setup();
        await settled(() => expect(at('async')).toBe('started'));
    });

    // And the value arrives as Python.
    //
    // An action is called by Svelte, with Svelte's values, and both wrappers —
    // the module's and the component's own — trimmed the arguments to the arity
    // and handed them over raw. So `use:mark={0.5}` gave Python a JavaScript
    // number, `format(value, '.2f')` answered *non-empty format string passed to
    // object.__format__*, and the component failed at mount.
    //
    // An integer beside it is why it went unseen for so long: 1 and 0.5 are the
    // same kind of value to JavaScript and two different things to Brython, so
    // an action that only ever took whole numbers worked.
    test.for([
        ['from a module', 'module'],
        ['written in the component', 'local']
    ])('a fractional parameter reaches an action %s', ([, which]) => {
        const read = setup();

        expect(read(`${which}-half`)).toBe('0.50');
        expect(read(`${which}-whole`)).toBe('1.00');
    });
});

// The boundary itself, called the way Svelte calls it rather than through a
// transition: both halves of what broke are here, and each failed on its own.
describe('what a module member becomes for Svelte', () => {
    const ready = () => {
        mount(DirectiveModule, { target: document.body.appendChild(document.createElement('div')) });
        flushSync();
        return pyModule('directive_mod');
    };

    // Svelte hands a transition three arguments; the Python signature declares
    // two, and Python refuses the extra one rather than ignoring it.
    test('takes the arguments Svelte passes, trimmed to what Python declared', () => {
        const node = document.createElement('p');
        node.textContent = 'abcd';

        const config = ready().typewriter(node, {}, { direction: 'in' });

        expect(config.duration).toBe(4);
    });

    // And the config comes back readable from JavaScript: Svelte reads
    // `.duration` and calls `.tick` itself, with fractions.
    test('and hands back a config JavaScript can read and call', () => {
        const node = document.createElement('p');
        node.textContent = 'abcd';

        const config = ready().typewriter(node, {}, {});

        expect(typeof config.tick).toBe('function');

        config.tick(0.5, 0.5);
        expect(node.textContent).toBe('ab');
    });

    // Svelte keeps what a directive gave it, so two reads of the same name have
    // to answer the same object.
    test('and answers the same function twice', () => {
        const module = ready();

        expect(module.typewriter).toBe(module.typewriter);
    });
});
