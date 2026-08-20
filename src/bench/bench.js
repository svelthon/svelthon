import { mount, flushSync } from 'svelte';
import BenchPy from './BenchPy.svelte';
import BenchJs from './BenchJs.svelte';

// Measured in a real browser, in real time: jsdom would give unrelated numbers,
// and Chromium's virtual time would skew the clock.
//
// The dispatch cost of a click is identical on both sides, so the gap between
// the columns really is the handler's. Python and JavaScript alternate on every
// round to cancel the machine's drift, and the minimum is kept — the least
// polluted measurement, not the average of the interruptions.
const ROUNDS = 7;

function run(Component) {
    const target = document.body.appendChild(document.createElement('div'));
    target.style.display = 'none';

    const started = performance.now();
    mount(Component, { target });
    flushSync();
    const mounted = performance.now() - started;

    const press = (key, times) => {
        const button = target.querySelector(`button[data-k="${key}"]`);
        const from = performance.now();
        for (let i = 0; i < times; i++) button.click();
        flushSync();
        return performance.now() - from;
    };

    press('tick', 100); // chauffe

    return { mount: mounted, tick: press('tick', 2000), heavy: press('heavy', 1500), fill: press('fill', 1) };
}

const best = (results) =>
    Object.fromEntries(
        ['mount', 'tick', 'heavy', 'fill'].map((k) => [k, Math.min(...results.map((r) => r[k]))])
    );

// The first mount in dev would measure nothing but Vite's on-the-fly
// compilation: load cost is measured on the production bundle, separately.
run(BenchPy);

const py = [];
const js = [];
for (let i = 0; i < ROUNDS; i++) {
    py.push(run(BenchPy));
    js.push(run(BenchJs));
}

const p = best(py);
const j = best(js);
const ms = (v) => `${v.toFixed(1)} ms`;
const ratio = (a, b) => (b < 0.05 ? '—' : `${(a / b).toFixed(1)}×`);

const rows = [
    ['warm mount', ms(p.mount), ms(j.mount), ratio(p.mount, j.mount)],
    ['2000 handler calls', ms(p.tick), ms(j.tick), ratio(p.tick, j.tick)],
    ['1500 × sum of 500 squares', ms(p.heavy), ms(j.heavy), ratio(p.heavy, j.heavy)],
    ['rendering a 500-row list', ms(p.fill), ms(j.fill), ratio(p.fill, j.fill)]
];

document.getElementById('out').textContent =
    `${''.padEnd(44)} ${'Python'.padStart(10)} ${'JS'.padStart(10)} ${'ratio'.padStart(7)}\n` +
    rows
        .map(([label, a, b, r]) => `${label.padEnd(44)} ${a.padStart(10)} ${b.padStart(10)} ${r.padStart(7)}`)
        .join('\n');
