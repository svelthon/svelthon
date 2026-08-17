import { mount, flushSync } from 'svelte';
import BenchPy from './BenchPy.svelte';
import BenchJs from './BenchJs.svelte';
import BenchPyExpr from './BenchPyExpr.svelte';

// Mesuré dans un vrai navigateur, en temps réel : jsdom donnerait des chiffres
// sans rapport, et le temps virtuel de Chromium fausserait l'horloge.
//
// Le coût de dispatch d'un clic est identique des deux côtés : l'écart entre les
// colonnes est donc bien imputable au handler. On alterne Python et JavaScript à
// chaque tour pour annuler la dérive de la machine, et on retient le minimum —
// la mesure la moins polluée, pas la moyenne des interruptions.
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

// Le premier montage en dev ne mesurerait que la compilation à la volée de
// Vite : le coût de chargement se mesure sur le bundle de production, à part.
run(BenchPy);

const py = [];
const js = [];
const ex = [];
for (let i = 0; i < ROUNDS; i++) {
    py.push(run(BenchPy));
    js.push(run(BenchJs));
    ex.push(run(BenchPyExpr));
}

const p = best(py);
const j = best(js);
const e = best(ex);
const ms = (v) => `${v.toFixed(1)} ms`;
const ratio = (a, b) => (b < 0.05 ? '—' : `${(a / b).toFixed(1)}×`);

const rows = [
    ['montage à chaud', ms(p.mount), ms(j.mount), ratio(p.mount, j.mount)],
    ['2000 appels de handler', ms(p.tick), ms(j.tick), ratio(p.tick, j.tick)],
    ['1500 × somme de 500 carrés', ms(p.heavy), ms(j.heavy), ratio(p.heavy, j.heavy)],
    ['rendu d’une liste de 500 lignes', ms(p.fill), ms(j.fill), ratio(p.fill, j.fill)],
    ['   …expressions compilées en Python', ms(e.fill), ms(j.fill), ratio(e.fill, j.fill)]
];

document.getElementById('out').textContent =
    `${''.padEnd(44)} ${'Python'.padStart(10)} ${'JS'.padStart(10)} ${'écart'.padStart(7)}\n` +
    rows
        .map(([label, a, b, r]) => `${label.padEnd(44)} ${a.padStart(10)} ${b.padStart(10)} ${r.padStart(7)}`)
        .join('\n');
