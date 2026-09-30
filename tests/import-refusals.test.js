// @vitest-environment node
//
// What a component can import: the modules the runtime holds, and the project's
// own `.py` files. Python's standard library does not ship, so an import of it
// is refused on its line when the component compiles, rather than failing at
// mount with a `JavascriptError` that `except ImportError` does not catch.
import { test, expect } from 'vitest';
import { python, svelthon } from '../src/lib/svelthon.js';

// Through the real preprocessor, which is what knows the file system. The file
// has to exist, because the hook reads the source back to map its lines.
const FILE = 'src/App.svelte';

const compiled = (written) => () => {
    const content = `<script lang="python">\nx = 1\n${written}\n</script>\n\n<p>{x}</p>\n`;
    const preprocessor = python();
    const { code } = preprocessor.markup({ content, filename: FILE });

    preprocessor.script({
        content: code.match(/<script lang="python">([\s\S]*?)<\/script>/)[1],
        attributes: { lang: 'python' },
        filename: FILE
    });
};

test.for([
    ['import json', /`json` is not a module a component can import.*`from_json\(text\)`.*\(src\/App\.svelte:3\)/],
    ['from dataclasses import dataclass', /`dataclasses` is not a module.*standard library does not ship.*\(src\/App\.svelte:3\)/],
    ['try:\n    import math\nexcept ImportError:\n    math = None', /`math` is not a module.*`js\.Math`.*\(src\/App\.svelte:4\)/],
    ['def later():\n    import sys', /`sys` is not a module.*\(src\/App\.svelte:4\)/],
    ['import browser.timer', /`browser\.timer` is not a module/],
    ['from browser import document, timer', /`browser\.timer` is not a module.*\(src\/App\.svelte:3\)/],
    ['from __future__ import annotations', /`__future__` is not a module/]
])('`%s` is refused on its line', ([written, message]) => {
    expect(compiled(written)).toThrow(message);
});

test('an import the runtime holds compiles', () => {
    expect(compiled('import browser.html\nfrom browser import document, html, aio\nfrom javascript import JSON')).not.toThrow();
});

// A `.py` module goes through the plugin, and is held to the same rule.
test('a module importing the standard library is refused too', () => {
    const plugin = svelthon({ path: [] });

    expect(() => plugin.load('tests/fixtures/stdlib_import.py')).toThrow(
        /`random` is not a module.*`js\.Math\.random\(\)`.*stdlib_import\.py:3\)/
    );
});
