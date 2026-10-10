// @vitest-environment node
//
// A method read off a watched instance is a new bound object on each read,
// with nothing of its own to change: its function and its instance are watched
// as themselves. Watching it as well would cost every method call on a watched
// instance a marker, three times the call itself.
import { test, expect } from 'vitest';
import '../src/lib/compile.cjs';
import { track, marks } from '../src/lib/runtime.js';

test('a method read off a watched instance is not watched itself', () => {
    const $B = globalThis.__BRYTHON__;
    const source = 'class Tile:\n    def grow(self):\n        pass\n\n\ntile = Tile()\n\n\ndef method():\n    return tile.grow\n';
    const js = $B.py2js({ src: source, filename: 'bound_method.py' }, 'bound_method', ['bound_method']).to_js();
    const module = new Function(`${js}\nreturn locals_bound_method_py;`)();

    track(module.tile, () => {}, () => {});

    expect(marks(module.tile)).toBeDefined();
    expect(marks($B.$call(module.method))).toBeUndefined();
});
