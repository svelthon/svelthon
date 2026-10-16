// How a cost grows with its size, measured against itself in the same run: the
// time of `factor` times the work over the time of the work, each the best of
// three runs, from a size whose run lasts tens of milliseconds. A linear cost
// gives about `factor`, a quadratic one its square, whatever else the machine
// is doing. A bound in milliseconds read the machine's load as much as the
// code: 1 169 ms and 1 743 ms over 1 000 for a linear mount, under a full suite
// or a coverage run.
//
// `run(n)` does the work at size `n` and answers the milliseconds it took.
export const growth = (run, { from = 1000, factor = 4, until = 30, most = 256_000 } = {}) => {
    const best = (n) => Math.min(run(n), run(n), run(n));
    let n = from;

    run(Math.max(1, Math.floor(from / 2)));
    while (n < most && best(n) < until) n *= 2;

    return best(factor * n) / Math.max(best(n), 1);
};

// The milliseconds a call takes.
export const timed = (call) => {
    const start = performance.now();

    call();

    return performance.now() - start;
};
