import '~/SVELTHON/src/lib/runtime.js';

const $B = globalThis.__BRYTHON__;
const _b_ = $B.builtins;

const src = `
def bench_append(xs, n):
    for i in range(n):
        xs.append(i)
    return len(xs)

def bench_read(xs, n):
    total = 0
    for i in range(n):
        total += len(xs)
    return total

def bench_setitem(d, n):
    for i in range(n):
        d["k"] = i
    return len(d)

def bench_calls(o, n):
    total = 0
    for i in range(n):
        total += o.bit_length()
    return total
`;

const name = 'spike1d';
const js = $B.py2js(src, name, name).to_js();
let ns;
{
    const previous = $B.namespace;
    $B.namespace = (n) => (ns = previous(n));
    try { (0, eval)(js); } finally { $B.namespace = previous; }
}

let notified = 0;
const tag = (o) => {
    Object.defineProperty(o, '$notify', { value: () => notified++, enumerable: false });
    return o;
};

const newList = () => _b_.list.$factory([]);
const newDict = () => _b_.dict.$factory();

console.log('liste marquée : get_class === list  :', $B.get_class(tag(newList())) === _b_.list);
console.log('liste marquée : repr                :', _b_.repr(tag(_b_.list.$factory([1, 2]))));
console.log('liste marquée : clés énumérables    :', JSON.stringify(Object.keys(tag(_b_.list.$factory([1, 2])))));

const timeit = (make, run, n) => {
    let best = Infinity;
    for (let round = 0; round < 7; round++) {
        const subject = make();
        const t0 = performance.now();
        run(subject, n);
        best = Math.min(best, performance.now() - t0);
    }
    return (best * 1000) / n;
};

const N = 20000;
const table = [];
const measure = (label) => {
    table.push([
        label,
        timeit(newList, ns.bench_append, N),
        timeit(() => tag(newList()), ns.bench_append, N),
        timeit(newList, ns.bench_read, N),
        timeit(() => 255, ns.bench_calls, N)
    ]);
};

measure('sans interception');

const MUTATORS = new Set([
    'append', 'extend', 'insert', 'pop', 'remove', 'clear', 'sort', 'reverse',
    'update', 'add', 'discard', 'setdefault', 'popitem'
]);

const callAttr = $B.call_attr;
$B.call_attr = function (obj, attr) {
    const result = callAttr.apply(null, arguments);
    if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined && MUTATORS.has(attr)) {
        obj.$notify();
    }
    return result;
};

const setitem = $B.$setitem;
$B.$setitem = function (obj) {
    const result = setitem.apply(null, arguments);
    if (obj !== null && typeof obj === 'object' && obj.$notify !== undefined) obj.$notify();
    return result;
};

measure('avec interception');

console.log('\n                       append  append(marquée)   len()   appel de méthode');
for (const [label, a, b, c, d] of table) {
    console.log(
        label.padEnd(20),
        `${a.toFixed(3)} µs`.padStart(9),
        `${b.toFixed(3)} µs`.padStart(13),
        `${c.toFixed(3)} µs`.padStart(11),
        `${d.toFixed(3)} µs`.padStart(14)
    );
}

notified = 0;
const xs = tag(newList());
ns.bench_append(xs, 5);
console.log('\nnotifications après 5 append   :', notified);

notified = 0;
const d = tag(newDict());
ns.bench_setitem(d, 5);
console.log('notifications après 5 d[k]=v   :', notified);

notified = 0;
ns.bench_read(tag(newList()), 5);
console.log('notifications après 5 lectures :', notified, '(doit être 0)');
