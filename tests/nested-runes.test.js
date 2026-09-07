// @vitest-environment node
//
// Build-time code: jsdom has no business here, and its null
// `document.currentScript` would break Brython's bootstrap.
import { test, expect, describe } from 'vitest';
import { createRequire } from 'node:module';

const { compile } = createRequire(import.meta.url)('../src/lib/compile.cjs');

// A rune lives at the top level of a component's module, and nowhere else.
// `surface()` reads the AST and never descends into a `def` or a `class`, so a
// rune written deeper is built and wired to nothing.
//
// The arrow already refused it, by indentation, before parsing. The decorator
// said nothing at all — the same construct spoke under one spelling and vanished
// under the other, which is worse than either rule alone.
describe('a rune written below the top level', () => {
    const script = (src) => () => compile(src, 'Probe', 'src/Probe.svelte');

    test('is refused when decorated inside a function', () => {
        expect(script('def register():\n    @effect\n    def inner():\n        pass\n')).toThrow(
            /`@effect` is only read there \(src\/Probe\.svelte:3\)/
        );
    });

    test('and under a dotted decorator too', () => {
        expect(script('def register():\n    @effect.pre\n    def inner():\n        pass\n')).toThrow(
            /`@effect\.pre` is only read there/
        );
    });

    // The call form is what `x => expr` compiles to, so it is the same rune in
    // its other spelling — and it was the silent one `decorators-are-identity`
    // warned about: `effect(lambda: …)` written by hand does nothing at all.
    test('and when called by hand', () => {
        expect(script('def register():\n    x = effect(lambda: 1)\n')).toThrow(
            /`effect\(\)` is only read there/
        );
    });

    test('and for inspect, which is read off the AST the same way', () => {
        expect(script('def register():\n    y = inspect(1)\n')).toThrow(/`inspect\(\)`/);
    });

    // A class body is no more the top level than a function body is.
    test('and inside a class', () => {
        expect(
            script('class Box:\n    @derived\n    def area(self):\n        return 1\n')
        ).toThrow(/`@derived`/);
    });

    test('but the top level itself is untouched', () => {
        expect(script('@effect\ndef top():\n    pass\n')).not.toThrow();
        expect(script('n = 0\n\n\ndoubled => n * 2\n')).not.toThrow();
    });

    test('and an ordinary nested function is nobody s business', () => {
        expect(script('def register():\n    def inner():\n        pass\n')).not.toThrow();
    });

    // The arrow refuses by indentation, before parsing, and said so first. The
    // two messages now describe the same rule.
    test('the arrow and the decorator now say the same thing', () => {
        const arrow = script('def register():\n    => print(1)\n');
        const decorated = script('def register():\n    @effect\n    def inner():\n        pass\n');

        expect(arrow).toThrow(/belong[s]? at the top level of the module/);
        expect(decorated).toThrow(/belongs at the top level of the module/);
    });
});
