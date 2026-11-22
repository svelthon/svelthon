// Mutation testing: change one thing the code decides, and see whether the suite
// notices. A mutant the suite does not kill is a line nothing checks.
//
// Not part of `npm test`, for the same reason `bench.sh` is not: it takes
// hours.
//
// **The cost, measured rather than guessed.** A full run saturates the machine
// on its own, so running mutants in parallel buys nothing. What does buy
// something is `--bail=1`: a killed mutant stops at the first red file. Most
// mutants die, so the sweep costs about a bail run per site, plus a full run per
// survivor.
//
// **It mutates a copy, never the tree it is run from.** It used to edit
// `src/lib` in place and restore it after each mutant, and that tree is the one
// other work happens in while a sweep runs for hours: a probe copying it, a
// commit staging it, a server serving it, each could take a mutant for the
// source. And a sweep killed outright, which no handler survives, left its
// mutant there for the next sweep to read as the original, restore after every
// mutant, and check by hash against itself. So the sweep runs in a worktree of
// `HEAD`, made for it and removed after it: what it measures is the commit it
// names, and the tree it is run from is never written but for its report.
//
//   node scripts/mutants.mjs            every site
//   node scripts/mutants.mjs 20         a sample of twenty, spread over the files
//
// And a part of the sites, written to a report of its own: each run takes a
// dozen workers of the machine, so two sweeps over two parts end sooner than
// one over both, and neither overwrites the other's report.
//
//   node scripts/mutants.mjs --sites=markup.js:3161-,svelthon.js --report=scripts/mutants.part.txt
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    closeSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    openSync,
    readFileSync,
    renameSync,
    rmSync,
    symlinkSync,
    writeFileSync,
    readdirSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const options = Object.fromEntries(
    process.argv
        .slice(2)
        .filter((one) => one.startsWith('--'))
        .map((one) => one.slice(2).split('='))
);
const REPORT = options.report ?? 'scripts/mutants.txt';

// Each part a file, and from a line to a line of it: `markup.js:3161-` is that
// file from line 3161 on, `svelthon.js` all of it.
const parts = options.sites?.split(',').map((one) => {
    const [file, span = ''] = one.split(':');
    const [from, to] = span.split('-');

    return { file, from: Number(from) || 1, to: Number(to) || Infinity };
});
const inParts = (file, line) => parts === undefined || parts.some((one) => one.file === file && line >= one.from && line <= one.to);

// A sweep costs hours, and the report of the last one is the only record of
// it. Starting a new one used to overwrite that, so a partial report — the one
// worth reading, because a sweep that stopped early stopped for a reason — was
// destroyed by the very next run.
if (existsSync(REPORT)) renameSync(REPORT, REPORT.replace(/(\.txt)?$/, '.previous.txt'));

// The copy: the commit's files, and the installed packages by a link each, the
// links Bryntime, Brycomp and Bryvend are installed by among them. Not Vite's caches,
// which are written while a suite runs, and are this copy's own.
const COMMIT = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
const TREE = mkdtempSync(join(tmpdir(), 'svelthon-mutants-'));

// Where a run's output goes, beside the copy rather than in it: see `run`.
const LOG = `${TREE}.log`;

// The verdicts measured so far, which the report is written from: see below.
const lines = [];
let complete = false;

// The copy goes with the sweep, however it ends, from the moment it exists, half
// made or whole. Installed once the sites were read, the handlers left a copy
// behind when linking the packages threw or a Ctrl-C came first, and git still
// listed it. And what was measured goes into the report before the sweep exits:
// the handlers left without writing it, so the last verdict was lost, and the
// report named as in flight the very mutant that had been measured.
const removeTree = () => {
    try {
        execFileSync('git', ['worktree', 'remove', '--force', TREE], { stdio: 'pipe' });
    } catch {
        // Not a worktree yet: the folder alone, and git forgets it.
        rmSync(TREE, { recursive: true, force: true });
        execFileSync('git', ['worktree', 'prune']);
    }
    rmSync(LOG, { force: true });
};
const stop = (code) => {
    if (lines.length > 0 && !complete) writeFileSync(REPORT, `${lines.join('\n')}\n  INTERRUPTED\n`);
    removeTree();
    process.exit(code);
};

// A sweep killed outright still leaves the copy, in the system's temporary
// directory and nowhere it can be mistaken for the source; the next sweep's
// `git worktree prune` forgets it once gone.
process.on('SIGINT', () => stop(130));
process.on('SIGTERM', () => stop(143));
process.on('uncaughtException', (error) => {
    console.error(error);
    stop(1);
});

execFileSync('git', ['worktree', 'prune']);
execFileSync('git', ['worktree', 'add', '--detach', TREE, 'HEAD'], { stdio: 'pipe' });
mkdirSync(join(TREE, 'node_modules'));
for (const entry of readdirSync('node_modules').filter((one) => !one.startsWith('.vite'))) {
    symlinkSync(join(process.cwd(), 'node_modules', entry), join(TREE, 'node_modules', entry));
}

const DIR = join(TREE, 'src/lib');

// Each rule changes a decision without changing what parses. A comment or a
// line carrying one is skipped: a mutant inside a comment measures nothing,
// which is what the first run of this instrument spent itself discovering.
// Measured on 4 952 lines of `src/lib` before the second half was added: the
// first seven rules reached 429 lines, and the count beside each new one is how
// many lines it reaches that **no rule reached at all**.
const RULES = [
    [' === ', ' !== '],
    [' !== ', ' === '],
    [' && ', ' || '],
    [' >= ', ' > '],
    [' <= ', ' < '],
    ['return true;', 'return false;'],
    ['return false;', 'return true;'],

    // `&&` was inverted and `||` was not, which is half a rule. 51 lines.
    [' || ', ' && '],

    // The arithmetic of an index, which is where a scanner is wrong by one:
    // `at + 1` against `at`, `end - 1` against `end`. 102 lines between them,
    // the largest block the instrument could not see. `+` is concatenation too,
    // and `'a' - 'b'` is NaN, which is a change a test ought to notice.
    [' + ', ' - '],
    [' - ', ' + '],

    // The loosening half of the boundary. `>=` → `>` and `<=` → `<` tighten,
    // and were already here; nothing widened a bound. 37 lines.
    [' < ', ' <= '],
    [' > ', ' >= '],

    // `??` answers only for null and undefined where `||` answers for every
    // falsy value, so `0`, `''` and `false` are the three the swap exposes.
    // 20 lines.
    [' ?? ', ' || ']
];

// Four times a green run, which is 50 s here, on twelve workers. A killed
// mutant stops at the first red file and is faster still; nothing legitimate
// takes this long. It was a minute, set for a suite of 14 s, and the suite grew
// past it: every survivor would have read as a mutant that never finished.
const TIMEOUT = 200_000;

const hash = (text) => createHash('sha1').update(text).digest('hex');

const sites = [];
// Every file, by its path under `DIR`.
for (const file of readdirSync(DIR, { recursive: true }).filter((one) => one.endsWith('.js'))) {
    const text = readFileSync(join(DIR, file), 'utf8').split('\n');

    text.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (line.includes('//')) return;

        for (const [from, to] of RULES) {
            if (line.includes(from)) {
                if (inParts(file, index + 1)) sites.push({ file, line: index + 1, from, to });
                return;
            }
        }
    });
}

// Spread a sample over the files rather than taking the first N of one.
const wanted = Number(process.argv.slice(2).find((one) => !one.startsWith('--'))) || sites.length;
const chosen = [];
if (wanted >= sites.length) chosen.push(...sites);
else {
    const byFile = new Map();
    for (const site of sites) {
        if (!byFile.has(site.file)) byFile.set(site.file, []);
        byFile.get(site.file).push(site);
    }
    const per = Math.ceil(wanted / byFile.size);
    for (const group of byFile.values()) {
        const step = Math.max(1, Math.floor(group.length / per));
        for (let i = 0; i < group.length && chosen.length < wanted; i += step) chosen.push(group[i]);
    }
}

// The header says what was planned, of which commit, and that the sweep is not
// over: a report read after an interruption must not pass for a complete one.
// The last line, written only at the end, says it is. The commit is what the
// line numbers are read against, which an edit makes stale.
lines.push(
    `${chosen.length} mutants planned of ${sites.length} sites${parts ? ` (${options.sites})` : ''}, at ${COMMIT}, ${new Date().toISOString()}, UNFINISHED until the last line says otherwise`,
    ''
);
let killed = 0;
const survivors = [];

for (const [index, site] of chosen.entries()) {
    // **A signal is heard between two mutants.** Every run is a synchronous
    // call, and a handler waits for the event loop, which a loop of them never
    // gave back: a TERM sent at 8 h 07 left a sweep running its next suite, and
    // only a KILL stopped it, its copy left behind. One turn of the loop per
    // mutant lets the handlers above run, at the latest when the run in
    // progress ends.
    await new Promise((done) => setImmediate(done));

    const path = join(DIR, site.file);
    const before = readFileSync(path, 'utf8');

    const source = before.split('\n');
    if (!source[site.line - 1].includes(site.from)) {
        lines.push(`  skipped  ${site.file}:${site.line}  the token moved`);
        continue;
    }
    source[site.line - 1] = source[site.line - 1].replace(site.from, site.to);
    writeFileSync(path, source.join('\n'));

    // **A mutant that does not parse measures nothing.** The rules change a
    // decision and keep the grammar, all but one place: `??` beside `??`,
    // `double ?? single ?? bare`, made `double || single ?? bare`, which
    // JavaScript refuses unparenthesised. The suite did not start, and the run
    // read as unread, a run spent on no question.
    if (spawnSync(process.execPath, ['--check', path]).status !== 0) {
        writeFileSync(path, before);
        lines.push(`  skipped  ${site.file}:${site.line}  ${site.from.trim()} -> ${site.to.trim()}  the mutant does not parse`);
        continue;
    }

    // **Say which site is currently cut open, before cutting it.** A sweep that
    // stops without a word, killed or with the machine, stops on a mutant, and
    // that mutant is the first thing to suspect: a loop, or a worker eating the
    // memory. The report was flushed every 25 mutants, so the in-flight site
    // used to die with the process; when the sweep still edited the tree it was
    // run from, it also stayed there, `closingPair` keeping `c !== open` and the
    // walrus rewrite silently no longer rewriting.
    writeFileSync(REPORT, `${lines.join('\n')}\n  IN FLIGHT ${site.file}:${site.line}  ${site.from.trim()} -> ${site.to.trim()}\n`);

    // **A mutant can hang, and a hang has no timeout above it.** `testTimeout`
    // bounds a test; a loop that never ends inside the *transform* is Vite
    // compiling, before any test exists, and nothing there is bounded.
    //
    // The shape is reachable, and was met while Brycomp lived in `src/lib`: its VLQ
    // encoder shifts with `>>>=` and stops at `while (rest > 0)`, so `>` → `>=`
    // never terminates. It is the arithmetic and boundary rules that do this —
    // `+` ↔ `-`, `<` → `<=`, `>` → `>=` — which is to say the ones added to
    // reach the index arithmetic of the scanners, where an off-by-one is the
    // defect worth finding.
    //
    // A run that does not finish in four times the suite's own wall time is a
    // **kill**, and the loudest kind: the mutant did not fail an assertion, it
    // stopped the project from building.
    let hung = false;
    let status = 0;

    // The time limit is GNU `timeout`'s, not `execFileSync`'s: that one kills
    // the child it started and nothing below it, so a hung vitest and its
    // thirty-one workers were left running, one full suite per hung mutant.
    // `timeout` sends its TERM to its whole process group, and the workers are
    // in it.
    //
    // **And a TERM is not always heard.** A loop in the preprocessor spins in
    // vitest's own process, whose handler for TERM waits on the event loop the
    // loop holds: `npx` dies, `timeout` sees its child gone and leaves without
    // the KILL it promised, and vitest lives on, holding the pipe its output
    // went to. The call waited on that pipe two and a half hours, at
    // `compile.js:268`, `>` → `>=`. So the output goes to a file, which nobody
    // has to close for the call to return, and what is left of the run's
    // process group, `timeout`'s own, is killed once it has.
    const run = (bail) => {
        const out = openSync(LOG, 'w');
        const result = spawnSync('timeout', ['-k', '5s', `${TIMEOUT / 1000}s`, 'npx', 'vitest', 'run', ...(bail ? ['--bail=1'] : [])], {
            cwd: TREE,
            stdio: ['ignore', out, out]
        });

        closeSync(out);

        // Nothing started, nothing to kill: `pid` is then 0, and a KILL sent to
        // group 0 is sent to this script's own.
        if (!result.pid) throw new Error(`timeout did not start: ${result.error?.message ?? 'no process'}`);

        try {
            process.kill(-result.pid, 'SIGKILL');
        } catch {
            // The group is empty, as it is after a run that ended by itself.
        }

        // 124 is the time limit, and the KILL that follows it is 137 by uutils'
        // `timeout`, or a death by that KILL by GNU's, which sends it to its
        // whole process group, itself in it.
        hung = result.status === 124 || result.status === 137 || result.signal === 'SIGKILL';
        status = result.status;

        return readFileSync(LOG, 'utf8');
    };

    // **`--bail=1` is a speed-up, and it makes a *green* answer untrustworthy.**
    // Bail cancels the files still in flight the moment one fails, so what the
    // summary counts depends on how 32 cores happened to schedule — and twice
    // now a mutant has read `SURVIVED` in a sweep and `killed` when the same
    // command was re-run by hand. `bridge.js:935` is the second: it stops the
    // mutation walk from ever notifying, and eight tests go red.
    //
    // A kill is cheap to believe: something was red, and bail could only have
    // cut the count short. **A survivor is the expensive claim** — it says *no
    // test in the project asks this* — so it alone is re-run without bail, and
    // the second answer is the one recorded. Seventy survivors cost seventy full
    // runs, which is a fifth of the sweep rather than a doubling of it.
    let output = run(true);

    if (!hung && !/Test Files\s+\d+ failed/.test(output)) output = run(false);

    writeFileSync(path, before);
    if (hash(readFileSync(path, 'utf8')) !== hash(before)) throw new Error(`restore failed: ${path}`);

    // A run that failed to start is not a survivor and not a kill: say so rather
    // than counting it, which is the trap the first sweep fell into when a grep
    // met a NUL byte and returned nothing.
    const counted = output.match(/Tests\s+(?:(\d+) failed)?[ |]*(\d+) passed/);
    const where = `${site.file}:${site.line}  ${site.from.trim()} -> ${site.to.trim()}`;

    // **A red file is a kill too, and reading only red tests scored three
    // mutants of `svelthon.js` as survivors that kill 114 test files each.**
    //
    // A mutant in the compiler, the markup pass or the preprocessor does not
    // make an assertion fail: it stops the file from *compiling*, so the file
    // never yields a test at all. Vitest counts that under `Test Files`, and
    // the `Tests` line above can then read `768 passed` with no failed segment
    // — indistinguishable from a green run by the regex.
    //
    // `--bail=1` made it worse by making it *random*: bail cancels the files
    // still in flight, so whether one test-level failure slipped in before the
    // cancel depends on how 32 cores happened to schedule. The same mutant read
    // `SURVIVED` in the sweep and `killed (1 red)` when re-run by hand.
    //
    // Checked before `counted`, because a run whose files all failed to collect
    // may print both lines and only this one carries the truth.
    const files = output.match(/Test Files\s+(\d+) failed/);

    // No count at all has two causes and they are opposite. A mutant can break
    // the code so early that no test file loads — the suite never reaches a
    // summary — and that is a kill, the loudest kind. Anything else that leaves
    // no count is unread, and unread is reported rather than guessed.
    const collapsed = /Unhandled Error|Failed to load|Error: Cannot|TypeError:/.test(output);

    // **And a survivor is a run that passed, which vitest says by its status.**
    // A mutant that sends the preprocessor into a loop growing without end
    // takes vitest's process down, `heap out of memory`, with no summary; or a
    // worker it runs in dies, and the summary counts the tests the others
    // passed, no failed among them, under an error of its own. Read by its
    // counts alone, `markup.js:3669` was a survivor that no run of it passed.
    const memory = /heap out of memory/.test(output);

    if (hung) { killed += 1; lines.push(`  killed   ${where}  (never finished)`); }
    // Named, the first of them: a kill by one red file is a claim about that
    // file, and one red under load for a reason of its own, a test that waits
    // on time, killed under three sweeps a mutant that passes the suite alone.
    else if (files) {
        killed += 1;
        const named = [...new Set([...output.matchAll(/FAIL\s+(tests\/\S+?\.test\.js)/g)].map((one) => one[1]))];
        lines.push(`  killed   ${where}  (${files[1]} red file${files[1] === '1' ? '' : 's'}${named.length ? `: ${named.slice(0, 3).join(', ')}` : ''})`);
    }
    else if (memory) { killed += 1; lines.push(`  killed   ${where}  (ran out of memory)`); }
    else if (!counted && collapsed) { killed += 1; lines.push(`  killed   ${where}  (the suite could not start)`); }
    else if (!counted) lines.push(`  UNREAD   ${where}  (status ${status})`);
    else if (counted[1]) { killed += 1; lines.push(`  killed   ${where}  (${counted[1]} red)`); }
    else if (status !== 0) { killed += 1; lines.push(`  killed   ${where}  (no test red, and the run failed: status ${status})`); }
    else { survivors.push(where); lines.push(`  SURVIVED ${where}`); }

    if ((index + 1) % 25 === 0) {
        lines.push(`  … ${index + 1} of ${chosen.length}, ${killed} killed, ${survivors.length} survived`);
        writeFileSync(REPORT, lines.join('\n'));
    }
}

lines.push('', `COMPLETE: ${killed} killed, ${survivors.length} survived, of ${chosen.length}`);
if (survivors.length) lines.push('', 'survivors:', ...survivors.map((one) => `  ${one}`));
writeFileSync(REPORT, `${lines.join('\n')}\n`);
complete = true;
removeTree();
console.log(lines.slice(-40).join('\n'));
