// @vitest-environment node
//
// `tests/scratch` is a room for throwaway probes, which the repository does not
// hold: nothing the suite keeps may read from it. A probe left in the collected
// directory once imported three files out of it. Measured by emptying the room
// and running the suite: `Failed to resolve import`. A file that written policy
// calls disposable was load-bearing.
//
// Fixtures are read too, because a fixture is how a collected test would reach
// the room without naming it.
import { test, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const COLLECTED = /\.(test|spec)\.[cm]?[jt]sx?$/;

// The room's name, spelled once and built into the pattern, so this file cannot
// match its own rule — a guard that reads sources has caught itself twice in
// this suite already.
const ROOM = 'scratch';
const READS = new RegExp(`['"]\\.{1,2}/${ROOM}/`);
const SELF = 'scratch-is-not-collected.test.js';

test('nothing the suite keeps reads from the scratch', () => {
    const here = fileURLToPath(new URL('.', import.meta.url));

    const named = [
        ...readdirSync(here)
            .filter((name) => COLLECTED.test(name) && name !== SELF)
            .map((name) => [name, `${here}${name}`]),
        ...readdirSync(`${here}fixtures`).map((name) => [
            `fixtures/${name}`,
            `${here}fixtures/${name}`
        ])
    ].filter(([, path]) => statSync(path).isFile() && READS.test(readFileSync(path, 'utf8')));

    expect(
        named.map(([name]) => name),
        `these read a room whose README says nothing there is kept: move what they ` +
            `need into tests/fixtures, or move them into the room`
    ).toEqual([]);
});
