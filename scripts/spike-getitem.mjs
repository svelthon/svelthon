// Témoin puis variante dans le même processus : on charge Brython nu, on mesure,
// on pose l'interception, on remesure.
import '~/SVELTHON/src/lib/globals.js';
import '~/SVELTHON/vendor/brython.js';
import '~/SVELTHON/src/lib/boot.js';

const $B = globalThis.__BRYTHON__;

const src = `
ints = list(range(100))
rows = [{"id": i} for i in range(100)]


def read_ints(xs, n):
    total = 0
    for i in range(n):
        total += xs[i % 100]
    return total


def read_rows(xs, n):
    total = 0
    for i in range(n):
        total += xs[i % 100]["id"]
    return total
`;

const js = $B.py2js(src, 'gi', 'gi').to_js();
let ns;
{
    const previous = $B.namespace;
    $B.namespace = (n) => (ns = previous(n));
    try { (0, eval)(js); } finally { $B.namespace = previous; }
}

const watch = (o) => {
    const marker = () => {};
    marker.bumps = [() => {}];
    marker.reads = [() => {}];
    marker.follow = () => {};
    Object.defineProperty(o, '$notify', { value: marker, enumerable: false, configurable: true });
    return o;
};

const timeit = (fn, subject, n) => {
    let best = Infinity;
    for (let round = 0; round < 7; round++) {
        const t0 = performance.now();
        fn(subject, n);
        best = Math.min(best, performance.now() - t0);
    }
    return (best * 1000) / n;
};

const N = 50000;
const ints = ns.ints;
const rows = ns.rows;
const watched = watch(ns.rows.slice());

const table = [];
const measure = (label) =>
    table.push([
        label,
        timeit(ns.read_ints, ints, N),
        timeit(ns.read_rows, rows, N),
        timeit(ns.read_rows, watched, N)
    ]);

measure('Brython nu');

// L'interception, telle qu'elle est dans bridge.js.
const mutableCls = new Set([$B.builtins.dict, $B.builtins.set]);
const mutable = (v) => Array.isArray(v) || mutableCls.has($B.get_class(v));
const mark = (v, bumps, reads) => {
    const m = () => { for (const one of bumps) one(); };
    m.bumps = bumps;
    m.reads = reads;
    m.follow = () => {};
    Object.defineProperty(v, '$notify', { value: m, enumerable: false, configurable: true });
    return v;
};
const inherit = (parent, child) => {
    if (child === null || typeof child !== 'object') return child;
    const marker = parent.$notify;
    const own = child.$notify;
    if (own !== undefined) {
        for (let i = 0; i < marker.bumps.length; i++) {
            if (!own.bumps.includes(marker.bumps[i])) {
                own.bumps.push(marker.bumps[i]);
                own.reads.push(marker.reads[i]);
            }
        }
        return child;
    }
    return mutable(child) ? mark(child, marker.bumps.slice(), marker.reads.slice()) : child;
};

const getitem = $B.$getitem;
$B.$getitem = function (obj, ...rest) {
    const result = getitem(obj, ...rest);
    if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined) inherit(obj, result);
    return result;
};

measure('intercepté');

console.log('\n                        xs[i] int   xs[i]["id"]   xs[i]["id"] sous garde');
for (const [label, a, b, c] of table) {
    console.log(
        label.padEnd(21),
        `${a.toFixed(3)} µs`.padStart(10),
        `${b.toFixed(3)} µs`.padStart(13),
        `${c.toFixed(3)} µs`.padStart(22)
    );
}
const [nu, patch] = table;
console.log('\nsurcoût  : int', ((patch[1] / nu[1] - 1) * 100).toFixed(1) + '%',
            '| dict', ((patch[2] / nu[2] - 1) * 100).toFixed(1) + '%',
            '| sous garde', ((patch[3] / nu[3] - 1) * 100).toFixed(1) + '%');
