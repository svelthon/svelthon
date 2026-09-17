// A configuration a JavaScript library builds: numbers, and callbacks that
// expect JavaScript numbers back.
//
// `toFixed` and `Number.isFinite` are what tell a number from an object holding
// one — arithmetic does not, which is why the two are here rather than a
// multiplication.
export function config() {
    return {
        duration: 400,
        easing: (t) => t * t,
        format: (t) => t.toFixed(2),
        finite: (t) => Number.isFinite(t)
    };
}
