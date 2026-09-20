// What the suite itself says, read the way `console-check.mjs` reads what a
// browser says.
//
// `tests/suite-is-quiet.test.js` counts one cause of noise, jsdom reporting a
// raise a test asked for, and `tests/emitted-warnings.test.js` compiles every
// fixture looking for a compiler warning. **Neither can see the run's own
// output**, and that is the property both files' prose claims. Measured: with
// the compile option removed from the build pass and left in the guard, the
// suite prints `options_missing_custom_element` on every run and stays green at
// 2 130 tests. A guard that recompiles a fixture is a proxy for the build, not
// the build.
//
// So this runs the suite and reads its two channels, which is the only place
// the question is actually asked. It is not inside `npm test` for the reason
// `bench.sh` and `browser-check.sh` are not: it starts a second full run, and a
// suite that runs itself does not terminate.
//
// **It is the only half that sees the wiring.** The two guards above test rules
// — one reads the test sources, the other recompiles the fixtures by calling
// the project's own `compileOptionsFor` — so a build that stops calling that
// rule leaves both of them green. Measured: with `dynamicCompileOptions` cut,
// `npm test` is 2 130 of 2 130 and every run prints the warning. Deleting this
// file as redundant would leave guards that look sufficient and are not.
//
//   node scripts/quiet-check.mjs
import { spawnSync } from 'node:child_process';

// Lines a green run is entitled to. Each is here because it says something true
// that no repair of ours can remove, and each is anchored so a longer line
// carrying the same words is still read.
const ALLOWED = [
    // vite-plugin-svelte says this on every project without a svelte.config.js,
    // and this project deliberately has none: its preprocessor is wired in
    // `vite.config.js`, where the plugin and the preprocessor are declared
    // together.
    /\[vite-plugin-svelte\] no Svelte config found at .* - using default configuration\.$/,
    // Node's own, about a vitest internal.
    /^\(node:\d+\) \[DEP\d+\] DeprecationWarning: _channel is deprecated\./,
    /^\(Use `node --trace-deprecation \.\.\.` to show where the warning was created\)$/
];

const run = spawnSync('npx', ['vitest', 'run'], { encoding: 'utf8', stdio: 'pipe' });
const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;

// Vitest's own reporter writes the summary and the progress to the same
// channels, so the noise is what is left after its shape is taken out: a
// reporter line starts with a marker or is part of the summary block.
const REPORTER = /^\s*(?:[✓×❯↓]|RUN |DEV |Test Files|Tests|Start at|Duration|stdout \||stderr \||⎯|$)/;

// Colour, which the reporter writes even to a pipe.
const plain = (line) => line.replace(/\[[0-9;]*m/g, '').trimEnd();

const said = output
    .split('\n')
    .map(plain)
    .filter((line) => line.trim() && !REPORTER.test(line))
    .filter((line) => !ALLOWED.some((one) => one.test(line)));

if (run.status !== 0) {
    console.error('✗ the suite is not green, so its output cannot be read for noise');
    process.exit(1);
}

if (said.length) {
    console.error(`✗ a green run said ${said.length} thing${said.length === 1 ? '' : 's'}:`);
    for (const line of said.slice(0, 20)) console.error(`    ${line}`);
    process.exit(1);
}

console.log('✓ suite — nothing said on a green run');
