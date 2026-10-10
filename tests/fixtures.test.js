import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';

// A fixture nobody imports is either dead weight or the shadow of a test file
// that went missing. Neither shows up as a failure anywhere else: the suite
// stays green while it quietly tests less.
test('no fixture is left unreached', () => {
    const files = readdirSync('tests/fixtures').filter(
        (name) => statSync(`tests/fixtures/${name}`).isFile() && name !== 'README.md'
    );

    // An importer is any fixture, one in a folder of its own included:
    // `warned/QuotedLoneValue.svelte` is what imports `QuotedLoneChild.svelte`.
    const importers = readdirSync('tests/fixtures', { recursive: true }).filter(
        (name) =>
            !/(?:^|\/)(?:node_modules|__pycache__)(?:\/|$)/.test(name) && statSync(`tests/fixtures/${name}`).isFile()
    );

    const sources = [
        ...readdirSync('tests')
            .filter((name) => name.endsWith('.test.js'))
            .map((name) => readFileSync(`tests/${name}`, 'utf8')),
        ...importers.map((name) => readFileSync(`tests/fixtures/${name}`, 'utf8'))
    ].join('\n');

    // `import(`./fixtures/Peps${which}.svelte`)` names its fixture at run time,
    // so the static half of the template is what can be matched.
    const prefixes = [...sources.matchAll(/fixtures\/(\w+)\$\{/g)].map((m) => m[1]);

    // The stem is what an importer writes: `Row.svelte` is `Row`, and
    // `keeper.svelte.py` is `keeper`, which is what `import keeper` says.
    const orphans = files.filter((name) => {
        const stem = name.split('.')[0];

        return !sources.includes(stem) && !prefixes.some((prefix) => stem.startsWith(prefix));
    });

    expect(orphans).toEqual([]);
});
