// Mutation testing: change one thing the code decides, and see whether the suite
// notices. A mutant the suite does not kill is a line nothing checks.
//
// Not part of `npm test`, for the same reason `bench.sh` and `browser-check.sh`
// are not: it takes minutes, and it edits the source while it runs.
//
// **The cost, measured rather than guessed.** A full run is 9,6 s wall but 257 s
// of CPU, so one run already saturates a 32-core machine and running mutants in
// parallel buys nothing. What does buy something is `--bail=1`: a killed mutant
// stops at the first red file, 3,5 s instead of 9,6. Most mutants die, so the
// average sits near four seconds and the whole sweep near twenty minutes.
//
// **Safety.** The source is restored after every mutant and the restore is
// checked by hash. An interrupt restores too — the handler is installed before
// the first edit — because a harness that edits what it audits has to put it back
// before anything else can fail.
//
//   node scripts/mutants.mjs            every site
//   node scripts/mutants.mjs 20         a sample of twenty, spread over the files
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'src/lib';
const REPORT = 'scripts/mutants.txt';

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

// Four times a green run, which is 14 s here. A killed mutant stops at the
// first red file and is faster still; nothing legitimate takes a minute.
const TIMEOUT = 60_000;

const hash = (text) => createHash('sha1').update(text).digest('hex');

const sites = [];
for (const file of readdirSync(DIR).filter((one) => /\.(js|cjs)$/.test(one))) {
    const lines = readFileSync(join(DIR, file), 'utf8').split('\n');

    lines.forEach((line, index) => {
        const trimmed = line.trim();
        if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) return;
        if (line.includes('//')) return;

        for (const [from, to] of RULES) {
            if (line.includes(from)) {
                sites.push({ file, line: index + 1, from, to });
                return;
            }
        }
    });
}

// Spread a sample over the files rather than taking the first N of one.
const wanted = Number(process.argv[2]) || sites.length;
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

const originals = new Map();
const restore = () => {
    for (const [path, text] of originals) {
        writeFileSync(path, text);
        if (hash(readFileSync(path, 'utf8')) !== hash(text)) console.error(`!! restore failed: ${path}`);
    }
};

process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });
process.on('uncaughtException', (error) => { restore(); throw error; });

const lines = [`${chosen.length} mutants of ${sites.length} sites, ${new Date().toISOString()}`, ''];
let killed = 0;
const survivors = [];

for (const [index, site] of chosen.entries()) {
    const path = join(DIR, site.file);
    const before = readFileSync(path, 'utf8');
    originals.set(path, before);

    const source = before.split('\n');
    if (!source[site.line - 1].includes(site.from)) {
        lines.push(`  skipped  ${site.file}:${site.line}  the token moved`);
        originals.delete(path);
        continue;
    }
    source[site.line - 1] = source[site.line - 1].replace(site.from, site.to);
    writeFileSync(path, source.join('\n'));

    // **Say which file is currently cut open, before cutting it.** The handlers
    // above put the source back for the signals a process can catch, and
    // `SIGKILL` is not one of them: a sweep stopped that way leaves exactly one
    // file mutated and no note of which.
    //
    // It happened, and the cost was the point of writing this: the report was
    // flushed every 25 mutants, so the in-flight site was in memory and died
    // with the process. `closingPair` kept `c !== open`, returned -1 for every
    // pair, and the walrus rewrite silently stopped rewriting — twenty minutes
    // spent reading a suite that had nothing wrong with it.
    writeFileSync(REPORT, `${lines.join('\n')}\n  IN FLIGHT ${site.file}:${site.line}  ${site.from.trim()} -> ${site.to.trim()}\n`);

    // **A mutant can hang, and a hang has no timeout above it.** `testTimeout`
    // bounds a test; a loop that never ends inside the *transform* is Vite
    // compiling, before any test exists, and nothing there is bounded.
    //
    // The shape is reachable and this file contains one: `compile.cjs`'s VLQ
    // encoder shifts with `>>>=` and stops at `while (rest > 0)`, so `>` → `>=`
    // never terminates. It is the arithmetic and boundary rules that do this —
    // `+` ↔ `-`, `<` → `<=`, `>` → `>=` — which is to say the ones added to
    // reach the index arithmetic of the scanners, where an off-by-one is the
    // defect worth finding.
    //
    // A run that does not finish in four times the suite's own wall time is a
    // **kill**, and the loudest kind: the mutant did not fail an assertion, it
    // stopped the project from building.
    let output = '';
    let hung = false;
    try {
        output = execFileSync('npx', ['vitest', 'run', '--bail=1'], {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: TIMEOUT,
            killSignal: 'SIGKILL'
        });
    } catch (error) {
        hung = error.code === 'ETIMEDOUT' || error.signal === 'SIGKILL';
        output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    }

    writeFileSync(path, before);
    if (hash(readFileSync(path, 'utf8')) !== hash(before)) throw new Error(`restore failed: ${path}`);
    originals.delete(path);

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

    if (hung) { killed += 1; lines.push(`  killed   ${where}  (never finished)`); }
    else if (files) { killed += 1; lines.push(`  killed   ${where}  (${files[1]} red file${files[1] === '1' ? '' : 's'})`); }
    else if (!counted && collapsed) { killed += 1; lines.push(`  killed   ${where}  (the suite could not start)`); }
    else if (!counted) lines.push(`  UNREAD   ${where}`);
    else if (counted[1]) { killed += 1; lines.push(`  killed   ${where}  (${counted[1]} red)`); }
    else { survivors.push(where); lines.push(`  SURVIVED ${where}`); }

    if ((index + 1) % 25 === 0) {
        lines.push(`  … ${index + 1} of ${chosen.length}, ${killed} killed, ${survivors.length} survived`);
        writeFileSync(REPORT, lines.join('\n'));
    }
}

lines.push('', `${killed} killed, ${survivors.length} survived, of ${chosen.length}`);
if (survivors.length) lines.push('', 'survivors:', ...survivors.map((one) => `  ${one}`));
writeFileSync(REPORT, `${lines.join('\n')}\n`);
console.log(lines.slice(-40).join('\n'));
