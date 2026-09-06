import { test, expect, describe } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';

// A fixture nobody imports is either dead weight or the shadow of a test file
// that went missing — which is how `boundary.test.js` was found gone, and how
// four fixtures from an earlier `svelte-surface` were found still lying there.
// Neither shows up as a failure anywhere else: the suite stays green while it
// quietly tests less.
describe('every fixture is reached by something', () => {
    const sources = [
        ...readdirSync('tests')
            .filter((name) => name.endsWith('.test.js'))
            .map((name) => readFileSync(`tests/${name}`, 'utf8')),
        ...readdirSync('tests/fixtures')
            .filter((name) => statSync(`tests/fixtures/${name}`).isFile())
            .map((name) => readFileSync(`tests/fixtures/${name}`, 'utf8'))
    ].join('\n');

    // `import(`./fixtures/Peps${which}.svelte`)` names its fixtures at run time,
    // so the static half of the template is what can be matched.
    const prefixes = [...sources.matchAll(/fixtures\/(\w+)\$\{/g)].map((m) => m[1]);

    const reached = (stem) =>
        sources.includes(stem) || prefixes.some((prefix) => stem.startsWith(prefix));

    // The stem is what an importer writes: `Row.svelte` is `Row`, and
    // `keeper.svelte.py` is `keeper`, which is what `import keeper` says.
    const fixtures = readdirSync('tests/fixtures')
        .filter((name) => statSync(`tests/fixtures/${name}`).isFile())
        .filter((name) => name !== 'README.md');

    test.for(fixtures)('%s', (name) => {
        expect({ name, reached: reached(name.split('.')[0]) }).toEqual({ name, reached: true });
    });
});
